package game

import "testing"

func TestBuildSeatRolesUsesStandardOrderFromDealer(t *testing.T) {
	roles := buildSeatRoles([]int{1, 2, 3, 4, 5, 6}, 1)

	want := []SeatRoleResp{
		{SeatIndex: 1, Role: "BTN"},
		{SeatIndex: 2, Role: "SB"},
		{SeatIndex: 3, Role: "BB"},
		{SeatIndex: 4, Role: "UTG"},
		{SeatIndex: 5, Role: "UTG+1"},
		{SeatIndex: 6, Role: "CO"},
	}
	if len(roles) != len(want) {
		t.Fatalf("len=%d want %d roles=%v", len(roles), len(want), roles)
	}
	for i := range want {
		if roles[i] != want[i] {
			t.Fatalf("role[%d]=%+v want %+v", i, roles[i], want[i])
		}
	}
}

func TestBuildSeatRolesHeadsUpDealerIsSmallBlind(t *testing.T) {
	roles := buildSeatRoles([]int{2, 5}, 5)

	want := []SeatRoleResp{
		{SeatIndex: 5, Role: "BTN/SB"},
		{SeatIndex: 2, Role: "BB"},
	}
	if len(roles) != len(want) {
		t.Fatalf("len=%d want %d roles=%v", len(roles), len(want), roles)
	}
	for i := range want {
		if roles[i] != want[i] {
			t.Fatalf("role[%d]=%+v want %+v", i, roles[i], want[i])
		}
	}
}

func TestStartCountdownRequiresConfiguredPlayerCount(t *testing.T) {
	room := &Room{
		MaxPlayers: 3,
		Status:     RoomStatusOpen,
		Players: []PlayerSeat{
			{SeatIndex: 1, Status: PlayerStatusReady, Wallet: 100},
			{SeatIndex: 2, Status: PlayerStatusReady, Wallet: 100},
		},
	}

	updateStartCountdownLocked(room, 100)

	if room.Round.Action.DeadlineAt != 0 {
		t.Fatalf("deadline=%d want 0", room.Round.Action.DeadlineAt)
	}
}

func TestPrepareEventCreatedWhenConfiguredPlayerCountIsSeated(t *testing.T) {
	room := &Room{
		MaxPlayers: 3,
		Status:     RoomStatusOpen,
		Players: []PlayerSeat{
			{SeatIndex: 1, Status: PlayerStatusReady, Wallet: 100},
			{SeatIndex: 2, Status: PlayerStatusReady, Wallet: 100},
			{SeatIndex: 3, Status: PlayerStatusReady, Wallet: 100},
		},
	}

	events := prepareRoomIfReadyLocked(room, 100)

	if len(events) != 1 {
		t.Fatalf("events=%v want one prepare event", events)
	}
	if events[0].Event != "prepare" {
		t.Fatalf("event=%s want prepare", events[0].Event)
	}
	data, ok := events[0].Data.(PrepareEventData)
	if !ok {
		t.Fatalf("data type=%T want PrepareEventData", events[0].Data)
	}
	if data.DealerSeatIndex < 1 || data.DealerSeatIndex > 3 {
		t.Fatalf("dealer=%d not in seated range", data.DealerSeatIndex)
	}
	if len(data.SeatRoles) != 3 {
		t.Fatalf("seat_roles=%v want 3 roles", data.SeatRoles)
	}
	if room.Round.Action.DeadlineAt != 0 {
		t.Fatalf("deadline=%d want 0", room.Round.Action.DeadlineAt)
	}
}

func TestProcessRoomTimersDoesNotAutoStartAfterPrepare(t *testing.T) {
	repo := NewRepository()
	roomStoreMu.Lock()
	roomStore = map[string]*Room{
		"manual-start": {
			RoomNumber:        "manual-start",
			MaxPlayers:        2,
			Status:            RoomStatusOpen,
			CountdownReadyKey: "1,2",
			Round: RoundState{
				DealerSeatIndex:  1,
				SmallBlindAmount: 1,
				BigBlindAmount:   2,
				Action:           ActionState{DeadlineAt: nowUnix() - 1},
			},
			Players: []PlayerSeat{
				{UserID: "u1", SeatIndex: 1, Status: PlayerStatusReady, Wallet: 100},
				{UserID: "u2", SeatIndex: 2, Status: PlayerStatusReady, Wallet: 100},
			},
		},
	}
	roomStoreMu.Unlock()
	t.Cleanup(func() {
		roomStoreMu.Lock()
		roomStore = map[string]*Room{}
		roomStoreMu.Unlock()
	})

	repo.ProcessRoomTimers()

	roomStoreMu.Lock()
	defer roomStoreMu.Unlock()
	room := roomStore["manual-start"]
	if room.Status != RoomStatusOpen {
		t.Fatalf("status=%s want open", room.Status)
	}
	if room.Round.HandNo != 0 {
		t.Fatalf("hand_no=%d want 0", room.Round.HandNo)
	}
}

func TestSitDownMovesSeatAndKeepsPlayerReadyWithoutStandUp(t *testing.T) {
	repo := NewRepository()
	roomStoreMu.Lock()
	roomStore = map[string]*Room{
		"move-seat": {
			RoomNumber: "move-seat",
			MaxPlayers: 3,
			Status:     RoomStatusOpen,
			Players: []PlayerSeat{
				{UserID: "u1", SeatIndex: 1, Status: PlayerStatusReady, Wallet: 100},
			},
		},
	}
	roomStoreMu.Unlock()
	t.Cleanup(func() {
		roomStoreMu.Lock()
		roomStore = map[string]*Room{}
		roomStoreMu.Unlock()
	})

	resp, err := repo.ApplyPlayerEvent("move-seat", "u1", "sit_down", map[string]any{"index": 2})

	if err != nil {
		t.Fatalf("ApplyPlayerEvent error=%v", err)
	}
	if got := resp.Players[0].SeatIndex; got != 2 {
		t.Fatalf("seat=%d want 2", got)
	}
	if got := resp.Players[0].Status; got != PlayerStatusReady {
		t.Fatalf("status=%s want ready", got)
	}
}

func TestNonPlayingLeaveRemovesSeatedNonOwnerImmediately(t *testing.T) {
	repo := NewRepository()
	roomStoreMu.Lock()
	roomStore = map[string]*Room{
		"leave-open": {
			RoomNumber: "leave-open",
			MaxPlayers: 2,
			Status:     RoomStatusOpen,
			Players: []PlayerSeat{
				{UserID: "owner", SeatIndex: -1, IsOwner: true, Status: PlayerStatusWaiting},
				{UserID: "u1", SeatIndex: 1, Status: PlayerStatusReady, Wallet: 0},
			},
		},
	}
	roomStoreMu.Unlock()
	t.Cleanup(func() {
		roomStoreMu.Lock()
		roomStore = map[string]*Room{}
		roomStoreMu.Unlock()
	})

	resp, err := repo.ApplyPlayerEvent("leave-open", "u1", "leave", nil)

	if err != nil {
		t.Fatalf("ApplyPlayerEvent error=%v", err)
	}
	if len(resp.Events) != 1 {
		t.Fatalf("events=%v want one leave event", resp.Events)
	}
	if resp.Events[0].Event != "leave" {
		t.Fatalf("event=%s want leave", resp.Events[0].Event)
	}
	data, ok := resp.Events[0].Data.(LeaveEventData)
	if !ok {
		t.Fatalf("data type=%T want LeaveEventData", resp.Events[0].Data)
	}
	if data.SeatIndex != 1 || data.Role != "player" || data.UserID != "u1" {
		t.Fatalf("leave data=%+v want seat=1 role=player user=u1", data)
	}
	for _, p := range resp.Players {
		if p.UserID == "u1" {
			t.Fatalf("leaving player still in room: %+v", p)
		}
	}
}

func TestLeaveEventMarksUnseatedUserAsWatcher(t *testing.T) {
	repo := NewRepository()
	roomStoreMu.Lock()
	roomStore = map[string]*Room{
		"leave-watcher": {
			RoomNumber: "leave-watcher",
			MaxPlayers: 2,
			Status:     RoomStatusOpen,
			Players: []PlayerSeat{
				{UserID: "u1", SeatIndex: -1, Status: PlayerStatusWaiting},
			},
		},
	}
	roomStoreMu.Unlock()
	t.Cleanup(func() {
		roomStoreMu.Lock()
		roomStore = map[string]*Room{}
		roomStoreMu.Unlock()
	})

	resp, err := repo.ApplyPlayerEvent("leave-watcher", "u1", "leave", nil)

	if err != nil {
		t.Fatalf("ApplyPlayerEvent error=%v", err)
	}
	if len(resp.Events) != 1 {
		t.Fatalf("events=%v want one leave event", resp.Events)
	}
	data, ok := resp.Events[0].Data.(LeaveEventData)
	if !ok {
		t.Fatalf("data type=%T want LeaveEventData", resp.Events[0].Data)
	}
	if data.SeatIndex != 0 || data.Role != "watcher" || data.UserID != "u1" {
		t.Fatalf("leave data=%+v want no seat role=watcher user=u1", data)
	}
}

func TestNonPlayingOwnerLeaveRemovesOwnerFromRoomPlayers(t *testing.T) {
	repo := NewRepository()
	roomStoreMu.Lock()
	roomStore = map[string]*Room{
		"owner-leave-open": {
			RoomNumber:  "owner-leave-open",
			OwnerUserID: "owner",
			RoomType:    "public",
			MaxPlayers:  2,
			Status:      RoomStatusOpen,
			Players: []PlayerSeat{
				{UserID: "owner", SeatIndex: 1, IsOwner: true, Status: PlayerStatusReady, Wallet: 0},
			},
		},
	}
	roomStoreMu.Unlock()
	t.Cleanup(func() {
		roomStoreMu.Lock()
		roomStore = map[string]*Room{}
		roomStoreMu.Unlock()
	})

	resp, err := repo.ApplyPlayerEvent("owner-leave-open", "owner", "leave", nil)

	if err != nil {
		t.Fatalf("ApplyPlayerEvent error=%v", err)
	}
	if len(resp.Players) != 0 {
		t.Fatalf("players=%+v want empty after owner leaves non-playing room", resp.Players)
	}

	rooms, _ := repo.GetJoinedRoomList("owner", 1, 20)
	if len(rooms) != 0 {
		t.Fatalf("joined rooms=%+v want none after owner leaves", rooms)
	}
	publicRooms, _ := repo.GetPublicRoomList(1, 20)
	if len(publicRooms) != 1 {
		t.Fatalf("public rooms len=%d want 1", len(publicRooms))
	}
	if len(publicRooms[0].Players) != 0 {
		t.Fatalf("public room players=%+v want empty", publicRooms[0].Players)
	}
}

func TestStartGameKeepsPreparedDealerForFirstHand(t *testing.T) {
	room := &Room{
		MaxPlayers:    3,
		Status:        RoomStatusOpen,
		SmallBlind:    1,
		ActionTimeout: 30,
		Round: RoundState{
			DealerSeatIndex:  2,
			SmallBlindAmount: 1,
			BigBlindAmount:   2,
		},
		Players: []PlayerSeat{
			{UserID: "u1", SeatIndex: 1, Status: PlayerStatusReady, Wallet: 100},
			{UserID: "u2", SeatIndex: 2, Status: PlayerStatusReady, Wallet: 100},
			{UserID: "u3", SeatIndex: 3, Status: PlayerStatusReady, Wallet: 100},
		},
	}

	if err := startGameLocked(room); err != nil {
		t.Fatalf("startGameLocked error=%v", err)
	}

	if room.Round.DealerSeatIndex != 2 {
		t.Fatalf("dealer=%d want prepared dealer 2", room.Round.DealerSeatIndex)
	}
}

func TestBuildGameOverEventIncludesPotDistributionAndWinners(t *testing.T) {
	room := &Room{
		Round: RoundState{
			LastHandKind:     "showdown",
			LastHandPotTotal: 200,
			LastHandRake:     10,
			LastHandPayouts: []LastHandPayout{
				{UserID: "u1", Nickname: "A", Amount: 190, HoleCards: []int{101, 102}},
			},
			LastHandLayers: []LastHandLayer{
				{Tier: 0, Amount: 190, Payouts: []LastHandPayout{{UserID: "u1", Nickname: "A", Amount: 190}}},
			},
			ShowdownBestHands: []ShowdownBestHand{
				{UserID: "u1", Nickname: "A", SeatIndex: 1, BestFive: []int{101, 102, 103, 104, 105}, HandCategory: "straight"},
			},
		},
		Players: []PlayerSeat{
			{UserID: "u1", Nickname: "A", SeatIndex: 1},
			{UserID: "u2", Nickname: "B", SeatIndex: 2},
		},
	}

	event := buildGameOverEvent(room)

	if event.Event != "gameover" || event.Type != "event" {
		t.Fatalf("event=%+v want gameover event", event)
	}
	data, ok := event.Data.(GameOverEventData)
	if !ok {
		t.Fatalf("data type=%T want GameOverEventData", event.Data)
	}
	if data.Kind != "showdown" || data.PotTotal != 200 || data.Rake != 10 {
		t.Fatalf("gameover data=%+v has wrong pot summary", data)
	}
	if len(data.Payouts) != 1 || data.Payouts[0].Amount != 190 {
		t.Fatalf("payouts=%+v want winner payout", data.Payouts)
	}
	if len(data.Layers) != 1 || data.Layers[0].Amount != 190 {
		t.Fatalf("layers=%+v want pot layer distribution", data.Layers)
	}
	if len(data.Winners) != 1 {
		t.Fatalf("winners=%+v want one winner", data.Winners)
	}
	w := data.Winners[0]
	if w.UserID != "u1" || w.SeatIndex != 1 || w.Amount != 190 || w.HandCategory != "straight" {
		t.Fatalf("winner=%+v want u1 seat 1 amount 190 straight", w)
	}
	if len(w.BestFive) != 5 {
		t.Fatalf("winner best five=%+v want five cards", w.BestFive)
	}
}

func TestHandEndEventsSendGameOverBeforePrepare(t *testing.T) {
	room := &Room{
		MaxPlayers:        2,
		Status:            RoomStatusOpen,
		CountdownReadyKey: "1,2",
		Round: RoundState{
			DealerSeatIndex:  1,
			LastHandKind:     "fold_win",
			LastHandPotTotal: 30,
			LastHandPayouts:  []LastHandPayout{{UserID: "u1", Nickname: "A", Amount: 30}},
		},
		Players: []PlayerSeat{
			{UserID: "u1", Nickname: "A", SeatIndex: 1, Status: PlayerStatusReady, Wallet: 100},
			{UserID: "u2", Nickname: "B", SeatIndex: 2, Status: PlayerStatusReady, Wallet: 100},
		},
	}

	events := buildHandEndEvents(room, 100)

	if len(events) != 2 {
		t.Fatalf("events=%+v want gameover then prepare", events)
	}
	if events[0].Event != "gameover" || events[1].Event != "prepare" {
		t.Fatalf("event order=%+v want gameover then prepare", events)
	}
}

func TestPlayerActionEndingHandReturnsGameOverThenPrepareEvents(t *testing.T) {
	repo := NewRepository()
	roomStoreMu.Lock()
	roomStore = map[string]*Room{
		"action-gameover": {
			RoomNumber:        "action-gameover",
			OwnerUserID:       "u1",
			MaxPlayers:        2,
			Status:            RoomStatusPlaying,
			ActionTimeout:     30,
			CountdownReadyKey: "1,2",
			BettingActed:      map[int]bool{},
			Round: RoundState{
				HandNo:           1,
				HandStartedAt:    nowUnixMilli() - 1000,
				Stage:            "preflop",
				DealerSeatIndex:  1,
				SmallBlindAmount: 1,
				BigBlindAmount:   2,
				Pot:              PotState{Total: 30},
				Action:           ActionState{CurrentTurnUserID: "u2"},
			},
			Players: []PlayerSeat{
				{UserID: "u1", Nickname: "A", SeatIndex: 1, Status: PlayerStatusReady, Cards: []int{101, 102}, Wallet: 90},
				{UserID: "u2", Nickname: "B", SeatIndex: 2, Status: PlayerStatusReady, Cards: []int{201, 202}, Wallet: 90},
			},
		},
	}
	roomStoreMu.Unlock()
	t.Cleanup(func() {
		roomStoreMu.Lock()
		roomStore = map[string]*Room{}
		roomStoreMu.Unlock()
	})

	resp, err := repo.ApplyPlayerEvent("action-gameover", "u2", "action", map[string]any{"kind": "fold"})

	if err != nil {
		t.Fatalf("ApplyPlayerEvent error=%v", err)
	}
	if len(resp.Events) != 2 {
		t.Fatalf("events=%+v want gameover then prepare", resp.Events)
	}
	if resp.Events[0].Event != "gameover" || resp.Events[1].Event != "prepare" {
		t.Fatalf("event order=%+v want gameover then prepare", resp.Events)
	}
	gameover, ok := resp.Events[0].Data.(GameOverEventData)
	if !ok {
		t.Fatalf("gameover data type=%T want GameOverEventData", resp.Events[0].Data)
	}
	if gameover.Kind != "fold_win" || gameover.PotTotal != 30 {
		t.Fatalf("gameover=%+v want fold_win pot 30", gameover)
	}
	if len(gameover.Winners) != 1 || gameover.Winners[0].UserID != "u1" || gameover.Winners[0].SeatIndex != 1 {
		t.Fatalf("winners=%+v want u1 on seat 1", gameover.Winners)
	}
	prepare, ok := resp.Events[1].Data.(PrepareEventData)
	if !ok {
		t.Fatalf("prepare data type=%T want PrepareEventData", resp.Events[1].Data)
	}
	if prepare.DealerSeatIndex != 2 {
		t.Fatalf("next dealer=%d want 2", prepare.DealerSeatIndex)
	}
}
