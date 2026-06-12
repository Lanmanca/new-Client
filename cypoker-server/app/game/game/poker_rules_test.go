package game

import (
	"math"
	"testing"
)

func TestPotRakeScale(t *testing.T) {
	scale, rake := potRakeScale(100, 5)
	if math.Abs(rake-5) > 1e-9 || math.Abs(scale-0.95) > 1e-9 {
		t.Fatalf("got scale=%v rake=%v", scale, rake)
	}
	scale, rake = potRakeScale(100, 0)
	if scale != 1 || rake != 0 {
		t.Fatalf("no commission: scale=%v rake=%v", scale, rake)
	}
}

func TestPotAfterRakeAmount(t *testing.T) {
	award, rake := potAfterRakeAmount(200, 10)
	if math.Abs(rake-20) > 1e-9 || math.Abs(award-180) > 1e-9 {
		t.Fatalf("award=%v rake=%v", award, rake)
	}
}

func TestSortWinnerIndicesLeftOfDealer(t *testing.T) {
	room := &Room{
		Round: RoundState{DealerSeatIndex: 2},
		Players: []PlayerSeat{
			{SeatIndex: 1},
			{SeatIndex: 2},
			{SeatIndex: 3},
			{SeatIndex: 4},
		},
	}
	w := []int{0, 2, 3}
	sortWinnerIndicesLeftOfDealer(room, w)
	// 从庄位 2 顺时针：2,3,4,1 → 排名 0,1,2,3；赢家座位 1,3,4 → 排名 3,1,2 → 排序后应先 3 再 4 再 1 → 下标 2,3,0
	if len(w) != 3 || w[0] != 2 || w[1] != 3 || w[2] != 0 {
		t.Fatalf("order %v want [2 3 0]", w)
	}
}

// 手工验收建议：2～3 人完整 preflop→river；一人全下边池；断网重连；MaxRounds=1 房间结束退回账外；坐下买入边界（小于 MinBuyIn / 大于账外余额）。
