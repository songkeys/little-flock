package main

import (
	"testing"
)

func establishedFarm(at int64) FarmState {
	s := initialState(at)
	s.Progression.Step = 15
	s.Buildings = Buildings{Shelter: true, Garden: true}
	s.Regions = []string{"home", "meadow", "forest", "highland"}
	s.Plots = makeGarden()
	s.Sheep = []Sheep{makeSheep("cloud", "云朵", "female", at, true), makeSheep("milktea", "奶茶", "male", at, true), makeSheep("mint", "薄荷", "female", at, true)}
	s.Discoveries = []string{"cloud", "milktea", "mint"}
	s.Inventory["seed_carrot"] = 3
	return s
}

func TestFarmingAndBreedingEconomy(t *testing.T) {
	at := int64(1700000000000)
	s := establishedFarm(at)
	for _, a := range []Action{{Type: "buy", ItemID: "feed", Quantity: -5}, {Type: "sell", ItemID: "wool_aurora", Quantity: 1}, {Type: "buy", ItemID: "coins", Quantity: 1}, {Type: "buy", ItemID: "seed_moonflower", Quantity: 99}} {
		old := cloneState(s)
		if _, err := applyAction(&s, a, at); err == nil {
			t.Fatalf("invalid action accepted: %+v", a)
		}
		if s.Coins != old.Coins {
			t.Fatal("invalid action changed coins")
		}
	}
	act := func(a Action, at int64) {
		t.Helper()
		if _, err := applyAction(&s, a, at); err != nil {
			t.Fatalf("%s: %v", a.Type, err)
		}
	}
	act(Action{Type: "plant", PlotID: "plot-2", CropID: "carrot"}, at)
	if _, err := applyAction(&s, Action{Type: "harvest", PlotID: "plot-2"}, at+100000); err == nil {
		t.Fatal("unwatered crop harvested")
	}
	act(Action{Type: "water", PlotID: "plot-2"}, at)
	if _, err := applyAction(&s, Action{Type: "harvest", PlotID: "plot-2"}, at+1000); err == nil {
		t.Fatal("unripe crop harvested")
	}
	act(Action{Type: "harvest", PlotID: "plot-2"}, at+75000)
	if s.Inventory["carrot"] != 3 || s.Plots[1].CropID != nil {
		t.Fatal("harvest did not produce expected items")
	}
	act(Action{Type: "sell", ItemID: "carrot", Quantity: 3}, at+75000)
	if s.Coins != 201 {
		t.Fatalf("sale coins = %d", s.Coins)
	}
	act(Action{Type: "breed", SheepID: s.Sheep[0].ID, PartnerID: s.Sheep[1].ID}, at+75000)
	if len(s.Sheep) != 4 || s.Coins != 156 || s.Stats.Births != 1 || s.Sheep[3].AdultAt != at+375000 {
		t.Fatal("birth state incorrect")
	}
	if _, err := applyAction(&s, Action{Type: "breed", SheepID: s.Sheep[0].ID, PartnerID: s.Sheep[1].ID}, at+76000); err == nil {
		t.Fatal("breeding cooldown bypassed")
	}
	if _, err := applyAction(&s, Action{Type: "shear", SheepID: s.Sheep[3].ID}, at+76000); err == nil {
		t.Fatal("baby could be sheared")
	}
	act(Action{Type: "pet", SheepID: s.Sheep[0].ID}, at+76000)
	xp := s.XP
	if _, err := applyAction(&s, Action{Type: "pet", SheepID: s.Sheep[0].ID}, at+77000); err == nil || s.XP != xp {
		t.Fatal("pet spam grants XP")
	}
}
func TestClockAndCarePause(t *testing.T) {
	at := int64(1700000000000)
	s := establishedFarm(at)
	tick(&s, at+5000, false)
	if s.ClockSeconds != 240 || s.Sheep[0].Hunger != 85 {
		t.Fatal("empty room care or clock did not pause")
	}
	tick(&s, at+10000, true)
	if s.ClockSeconds != 245 || s.Sheep[0].Hunger >= 85 {
		t.Fatal("active room did not advance")
	}
	s.ClockSeconds = 2879
	s.UpdatedAt = at
	tick(&s, at+2000, true)
	if s.Day != 5 || s.Weather != "sunny" {
		t.Fatal("day update incorrect")
	}
}
