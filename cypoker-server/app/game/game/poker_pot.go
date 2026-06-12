package game

import (
	"math"
	"sort"
)

type potLayer struct {
	Amount   float64
	Eligible []int // 玩家下标，有资格赢取该层底池（未弃牌）
}

// buildPotLayers 按各座位本手累计贡献拆分主池/边池层（标准剥洋葱算法）。
func buildPotLayers(room *Room) []potLayer {
	type ent struct {
		idx     int
		contrib float64
		folded  bool
	}
	var ents []ent
	for i := range room.Players {
		c := room.Players[i].ContributedThisHand
		if c < chipEps {
			continue
		}
		ents = append(ents, ent{i, c, room.Players[i].Folded})
	}
	if len(ents) == 0 {
		return nil
	}
	var layers []potLayer
	for len(ents) > 0 {
		sort.Slice(ents, func(a, b int) bool { return ents[a].contrib < ents[b].contrib })
		low := ents[0].contrib
		if low < chipEps {
			break
		}
		var eligible []int
		for _, e := range ents {
			if !e.folded {
				eligible = append(eligible, e.idx)
			}
		}
		amt := low * float64(len(ents))
		layers = append(layers, potLayer{Amount: amt, Eligible: eligible})
		for i := range ents {
			ents[i].contrib -= low
		}
		var next []ent
		for _, e := range ents {
			if e.contrib > chipEps {
				next = append(next, e)
			}
		}
		ents = next
	}
	return layers
}

func recalcPotMainSide(room *Room) {
	layers := buildPotLayers(room)
	if len(layers) == 0 {
		room.Round.Pot.MainPot = 0
		room.Round.Pot.SidePot = 0
		return
	}
	room.Round.Pot.MainPot = layers[0].Amount
	side := 0.0
	for i := 1; i < len(layers); i++ {
		side += layers[i].Amount
	}
	room.Round.Pot.SidePot = side
	sum := room.Round.Pot.MainPot + room.Round.Pot.SidePot
	if math.Abs(sum-room.Round.Pot.Total) > 0.05 {
		room.Round.Pot.MainPot = room.Round.Pot.Total
		room.Round.Pot.SidePot = 0
	}
}

func pickMVPWinnerAmong(room *Room, eligible []int) int {
	bestSeat := int(1e9)
	bestIdx := -1
	for _, idx := range eligible {
		if idx < 0 || idx >= len(room.Players) {
			continue
		}
		s := room.Players[idx].SeatIndex
		if s > 0 && s < bestSeat {
			bestSeat = s
			bestIdx = idx
		}
	}
	return bestIdx
}

func nonFoldedInHandIndices(room *Room) []int {
	var out []int
	for i := range room.Players {
		if playerInHand(&room.Players[i]) && !room.Players[i].Folded {
			out = append(out, i)
		}
	}
	return out
}
