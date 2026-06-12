package game

import "sort"

// 牌编码：suit*100+rank，rank 1=A … 13=K（与 room_lifecycle 发牌一致）

func cardRankAceHigh(card int) int {
	r := card % 100
	if r == 1 {
		return 14
	}
	return r
}

func cardSuit(card int) int {
	if card <= 0 {
		return 0
	}
	return card / 100
}

// evalHoldemBest 7 张里选最优 5 张比大小，越大越强。
func evalHoldemBest(room *Room, pi int) uint64 {
	var cs []int
	for _, c := range room.Players[pi].Cards {
		if c > 0 {
			cs = append(cs, c)
		}
	}
	for _, c := range communityBoardForEval(room) {
		if c > 0 {
			cs = append(cs, c)
		}
	}
	if len(cs) < 2 {
		return 0
	}
	if len(cs) == 5 {
		return scoreFiveCards(cs)
	}
	best := uint64(0)
	n := len(cs)
	// C(n,5)
	for a := 0; a < n; a++ {
		for b := a + 1; b < n; b++ {
			for c := b + 1; c < n; c++ {
				for d := c + 1; d < n; d++ {
					for e := d + 1; e < n; e++ {
						five := []int{cs[a], cs[b], cs[c], cs[d], cs[e]}
						s := scoreFiveCards(five)
						if s > best {
							best = s
						}
					}
				}
			}
		}
	}
	return best
}

// holdemBestFiveCards 与 evalHoldemBest 同规则，但返回得分最高的那 5 张牌（按牌点降序、同点按编码降序便于展示）。
func holdemBestFiveCards(room *Room, pi int) ([]int, uint64) {
	var cs []int
	for _, c := range room.Players[pi].Cards {
		if c > 0 {
			cs = append(cs, c)
		}
	}
	for _, c := range communityBoardForEval(room) {
		if c > 0 {
			cs = append(cs, c)
		}
	}
	if len(cs) < 2 {
		return nil, 0
	}
	if len(cs) == 5 {
		five := append([]int(nil), cs...)
		sortFiveCardsDisplayOrder(five)
		return five, scoreFiveCards(five)
	}
	best := uint64(0)
	var bestFive []int
	n := len(cs)
	for a := 0; a < n; a++ {
		for b := a + 1; b < n; b++ {
			for c := b + 1; c < n; c++ {
				for d := c + 1; d < n; d++ {
					for e := d + 1; e < n; e++ {
						five := []int{cs[a], cs[b], cs[c], cs[d], cs[e]}
						s := scoreFiveCards(five)
						if s > best {
							best = s
							bestFive = append([]int(nil), five...)
						}
					}
				}
			}
		}
	}
	if len(bestFive) > 0 {
		sortFiveCardsDisplayOrder(bestFive)
	}
	return bestFive, best
}

func sortFiveCardsDisplayOrder(five []int) {
	sort.Slice(five, func(i, j int) bool {
		ri, rj := cardRankAceHigh(five[i]), cardRankAceHigh(five[j])
		if ri != rj {
			return ri > rj
		}
		return five[i] > five[j]
	})
}

// handCategoryFromScore 从 pack 分数的高 8 位解析牌型，供客户端 i18n。
func handCategoryFromScore(score uint64) string {
	if score == 0 {
		return "high_card"
	}
	cat := int(score >> 56)
	switch cat {
	case 8:
		return "straight_flush"
	case 7:
		return "four_of_a_kind"
	case 6:
		return "full_house"
	case 5:
		return "flush"
	case 4:
		return "straight"
	case 3:
		return "three_of_a_kind"
	case 2:
		return "two_pair"
	case 1:
		return "pair"
	default:
		return "high_card"
	}
}

// bestShowdownWinners 在 eligible 玩家中下标中，牌力最大者（可多人平分）。
func bestShowdownWinners(room *Room, eligible []int) []int {
	var best uint64
	var out []int
	for _, idx := range eligible {
		if idx < 0 || idx >= len(room.Players) {
			continue
		}
		if !playerInHand(&room.Players[idx]) || room.Players[idx].Folded {
			continue
		}
		s := evalHoldemBest(room, idx)
		if len(out) == 0 || s > best {
			best = s
			out = []int{idx}
		} else if s == best {
			out = append(out, idx)
		}
	}
	return out
}

func scoreFiveCards(cards []int) uint64 {
	if len(cards) != 5 {
		return 0
	}
	r := make([]int, 5)
	su := make([]int, 5)
	for i := range cards {
		r[i] = cardRankAceHigh(cards[i])
		su[i] = cardSuit(cards[i])
	}
	sort.Sort(sort.Reverse(sort.IntSlice(r)))

	flush := true
	for i := 1; i < 5; i++ {
		if su[i] != su[0] || su[i] <= 0 {
			flush = false
			break
		}
	}

	freq := map[int]int{}
	for _, v := range r {
		freq[v]++
	}
	type pair struct {
		rank  int
		count int
	}
	var groups []pair
	for rank, c := range freq {
		groups = append(groups, pair{rank, c})
	}
	sort.Slice(groups, func(i, j int) bool {
		if groups[i].count != groups[j].count {
			return groups[i].count > groups[j].count
		}
		return groups[i].rank > groups[j].rank
	})

	strHigh, strOk := straightHigh(r)
	sfHigh := uint64(0)
	if flush && strOk {
		sfHigh = uint64(strHigh)
	}

	// 类别 8…1，每类再打包踢脚
	if sfHigh > 0 {
		return pack(8, []uint64{sfHigh})
	}
	if groups[0].count == 4 {
		k := kickerExcept(r, groups[0].rank)
		return pack(7, []uint64{uint64(groups[0].rank), uint64(k)})
	}
	if groups[0].count == 3 && len(groups) > 1 && groups[1].count == 2 {
		return pack(6, []uint64{uint64(groups[0].rank), uint64(groups[1].rank)})
	}
	if groups[0].count == 3 {
		k := kickersTwoExcept(r, groups[0].rank)
		return pack(3, []uint64{uint64(groups[0].rank), k[0], k[1]})
	}
	if flush {
		return pack(5, ranksToU64(r))
	}
	if strOk {
		return pack(4, []uint64{uint64(strHigh)})
	}
	if len(groups) >= 2 && groups[0].count == 2 && groups[1].count == 2 {
		high := groups[0].rank
		low := groups[1].rank
		k := 0
		for _, v := range r {
			if v != high && v != low {
				k = v
				break
			}
		}
		return pack(2, []uint64{uint64(high), uint64(low), uint64(k)})
	}
	if groups[0].count == 2 {
		ks := kickersThreeExcept(r, groups[0].rank)
		return pack(1, []uint64{uint64(groups[0].rank), ks[0], ks[1], ks[2]})
	}
	return pack(0, ranksToU64(r))
}

func pack(cat int, parts []uint64) uint64 {
	var x uint64
	x = uint64(cat) << 56
	shift := uint(48)
	for _, p := range parts {
		if shift < 8 {
			break
		}
		x |= (p & 0xffff) << shift
		shift -= 8
	}
	return x
}

func ranksToU64(r []int) []uint64 {
	out := make([]uint64, len(r))
	for i, v := range r {
		out[i] = uint64(v)
	}
	return out
}

func straightHigh(sortedDesc []int) (int, bool) {
	uniq := make([]int, 0, 5)
	for _, v := range sortedDesc {
		if len(uniq) == 0 || uniq[len(uniq)-1] != v {
			uniq = append(uniq, v)
		}
	}
	// A 作为 1 的顺子：A,5,4,3,2
	has := func(x int) bool {
		for _, u := range uniq {
			if u == x {
				return true
			}
		}
		return false
	}
	if has(14) && has(5) && has(4) && has(3) && has(2) {
		return 5, true
	}
	for i := 0; i+4 <= len(uniq)-1; i++ {
		ok := true
		for j := 0; j < 4; j++ {
			if uniq[i+j]-uniq[i+j+1] != 1 {
				ok = false
				break
			}
		}
		if ok {
			return uniq[i], true
		}
	}
	return 0, false
}

func kickerExcept(r []int, avoid int) int {
	for _, v := range r {
		if v != avoid {
			return v
		}
	}
	return 0
}

func kickersTwoExcept(r []int, avoid int) [2]uint64 {
	var out [2]uint64
	n := 0
	for _, v := range r {
		if v == avoid {
			continue
		}
		out[n] = uint64(v)
		n++
		if n == 2 {
			break
		}
	}
	return out
}

func kickersThreeExcept(r []int, avoid int) [3]uint64 {
	var out [3]uint64
	n := 0
	for _, v := range r {
		if v == avoid {
			continue
		}
		out[n] = uint64(v)
		n++
		if n == 3 {
			break
		}
	}
	return out
}
