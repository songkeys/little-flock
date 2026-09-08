package main

import (
	"bytes"
	"os"
	"reflect"
	"slices"
	"testing"
)

func TestProgressiveJourneyAndSpatialActions(t *testing.T) {
	at := int64(1700000000000)
	rr := RuntimeRoom{record: RoomRecord{State: initialState(at)}, clients: map[*Client]bool{}}
	s := &rr.record.State
	if len(s.Sheep) != 0 || len(s.Plots) != 0 || len(s.Orders) != 0 || s.Coins != 180 || s.Inventory["feed"] != 2 || len(s.Inventory) != 1 {
		t.Fatal("a new farm must start empty with the agreed supplies")
	}
	client := &Client{user: User{ID: "leader"}, player: Player{Position: worldMap.Home.ReturnPoint}}
	rr.clients[client] = true
	action := func(a Action) {
		t.Helper()
		a.actorID = client.user.ID
		a.actorPosition = rr.playerPosition(client.user.ID)
		if s.Grazing.LeaderID != nil {
			a.leaderOnline = rr.playerPosition(*s.Grazing.LeaderID) != nil
		}
		if _, err := applyAction(s, a, at); err != nil {
			t.Fatalf("step %d, %s: %v", s.Progression.Step, a.Type, err)
		}
	}
	reject := func(a Action) {
		t.Helper()
		before := cloneState(*s)
		if _, err := applyAction(s, a, at); err == nil {
			t.Fatalf("accepted an unavailable action at step %d: %+v", s.Progression.Step, a)
		}
		if !reflect.DeepEqual(before, *s) {
			t.Fatal("a rejected action mutated the shared farm")
		}
	}
	step := func(want int) {
		t.Helper()
		if s.Progression.Step != want {
			t.Fatalf("step = %d, want %d", s.Progression.Step, want)
		}
	}
	reject(Action{Type: "adopt"})
	reject(Action{Type: "build", Facility: "garden"})
	action(Action{Type: "build", Facility: "shelter"})
	step(1)
	action(Action{Type: "adopt"})
	step(2)
	first := s.Sheep[0]
	if first.Name != "棉花糖" || first.BreedID != "cloud" || first.Sex != "female" || first.AdultAt > at || first.Wool != 100 {
		t.Fatal("first adoption must be an adult cloud sheep ready for the care tutorial")
	}
	reject(Action{Type: "adopt"})
	reject(Action{Type: "shear", SheepID: first.ID})
	action(Action{Type: "pet", SheepID: first.ID})
	step(3)
	action(Action{Type: "feed", SheepID: first.ID})
	step(4)
	action(Action{Type: "shear", SheepID: first.ID})
	step(5)
	action(Action{Type: "build", Facility: "garden"})
	step(6)
	if len(s.Plots) != 6 || s.Inventory["seed_clover"] != 3 || s.Inventory["seed_carrot"] != 0 {
		t.Fatal("garden supplies did not unlock progressively")
	}
	reject(Action{Type: "buy", ItemID: "seed_carrot", Quantity: 1})
	reject(Action{Type: "plant", CropID: "carrot", PlotID: "plot-1"})
	action(Action{Type: "plant", CropID: "clover", PlotID: "plot-1"})
	step(7)
	action(Action{Type: "water", PlotID: "plot-1"})
	step(8)
	reject(Action{Type: "harvest", PlotID: "plot-1"})
	at += 45000
	action(Action{Type: "harvest", PlotID: "plot-1"})
	step(9)
	if len(s.Orders) != 1 || s.Orders[0].ItemID != "clover" || s.Orders[0].Quantity != 3 || s.Inventory["seed_carrot"] != 3 {
		t.Fatal("first delivery or carrot seed gift is missing")
	}
	action(Action{Type: "plant", CropID: "carrot", PlotID: "plot-1"})
	action(Action{Type: "water", PlotID: "plot-1"})
	at += 75000
	action(Action{Type: "harvest", PlotID: "plot-1"})
	step(9)
	action(Action{Type: "order", OrderID: s.Orders[0].ID})
	step(10)
	if !slices.Contains(s.Regions, "meadow") || s.Coins != 140 {
		t.Fatal("first delivery did not unlock the meadow")
	}
	reject(Action{Type: "startGraze"}) // REST coordinates alone cannot start a trip.
	action(Action{Type: "startGraze"})
	step(11)
	at += 5000
	rr.tick(at)
	if s.Grazing.GrazeSeconds != 0 {
		t.Fatal("standing at home counted as grazing")
	}
	client.player.Position = worldMap.Meadow.GrazePoint
	at += 5000
	rr.tick(at)
	delete(rr.clients, client)
	at += 10000
	rr.tick(at)
	if s.Grazing.GrazeSeconds != 5 {
		t.Fatal("disconnected leader accrued grazing progress")
	}
	rr.clients[client] = true
	for i := 0; i < 3; i++ {
		at += 5000
		rr.tick(at)
	}
	reject(Action{Type: "finishGraze", actorID: client.user.ID, actorPosition: &worldMap.Home.ReturnPoint})
	reject(Action{Type: "waterFlock", actorID: "other", actorPosition: &worldMap.Meadow.WaterPoint})
	client.player.Position = worldMap.Meadow.WaterPoint
	action(Action{Type: "waterFlock"})
	reject(Action{Type: "finishGraze", actorID: client.user.ID, actorPosition: &client.player.Position})
	client.player.Position = worldMap.Home.ReturnPoint
	action(Action{Type: "finishGraze"})
	step(12)
	if s.Coins != 320 || s.Grazing.CompletedCount != 1 || s.Grazing.Active || s.Inventory["seed_daisy"] != 2 {
		t.Fatal("first graze must fund adoption and breeding")
	}
	reject(Action{Type: "rehome", SheepID: first.ID})
	action(Action{Type: "adopt"})
	if s.Sheep[1].Sex == s.Sheep[0].Sex || s.Sheep[1].BreedID != "milktea" {
		t.Fatal("second sheep cannot form a breeding pair")
	}
	action(Action{Type: "breed", SheepID: first.ID, PartnerID: s.Sheep[1].ID})
	step(13)
	if !slices.Contains(s.Regions, "forest") || s.Level < 3 {
		t.Fatal("first birth should open the forest and reach level 3")
	}
	reject(Action{Type: "forage", NodeID: s.ForageNodes[0].ID, actorPosition: &worldMap.Home.ReturnPoint})
	for i := range s.ForageNodes {
		node := s.ForageNodes[i]
		if node.ItemID == "mushroom" {
			client.player.Position = node.Position
			action(Action{Type: "forage", NodeID: node.ID})
			reject(Action{Type: "forage", NodeID: node.ID, actorPosition: &node.Position})
		}
	}
	step(14)
	action(Action{Type: "unlockRegion", RegionID: "highland"})
	step(15)
	if s.Coins != 45 || s.Inventory["mushroom"] != 0 || s.Inventory["carrot"] != 0 || !slices.Contains(s.Regions, "highland") {
		t.Fatal("highland resources were not charged exactly once")
	}
	reject(Action{Type: "unlockRegion", RegionID: "highland"})
	s.DayProgress = .9
	client.player.Position = worldMap.Highland.ViewPoint
	action(Action{Type: "stargaze"})
	if s.Progression.LastStargazeDay != s.Day || s.Inventory["seed_moonflower"] != 1 || s.Coins != 60 {
		t.Fatal("stargazing did not grant its daily reward")
	}
	reject(Action{Type: "stargaze", actorPosition: &client.player.Position})
	s.Day++
	s.DayProgress = .5
	reject(Action{Type: "stargaze", actorPosition: &client.player.Position})
	beforeDiscoveries := slices.Clone(s.Discoveries)
	action(Action{Type: "rehome", SheepID: s.Sheep[2].ID})
	if len(s.Sheep) != 2 || !slices.Equal(beforeDiscoveries, s.Discoveries) || s.Coins != 60 {
		t.Fatal("rehoming must preserve discoveries without paying coins")
	}
	// The persisted JSON representation includes region unlocks and node timers.
	if restored := cloneState(*s); !reflect.DeepEqual(restored, *s) {
		t.Fatal("the completed journey does not round-trip through persistence JSON")
	}
}

func TestProgressionRainRegionsAndOrderPool(t *testing.T) {
	canonical, err := os.ReadFile("../src/game/regions.json")
	if err != nil || !bytes.Equal(canonical, regionsJSON) {
		t.Fatal("backend and world map definitions differ")
	}
	at := int64(1700000000000)
	s := initialState(at)
	s.Progression.Step = 6
	s.Buildings.Garden = true
	s.Plots = makeGarden()
	s.Inventory["seed_clover"] = 1
	s.Weather = "rain"
	for _, a := range []Action{{Type: "plant", PlotID: "plot-1", CropID: "clover"}, {Type: "water", PlotID: "plot-1"}} {
		if _, err := applyAction(&s, a, at); err != nil {
			t.Fatal("rain blocked the watering objective:", err)
		}
	}
	if s.Progression.Step != 8 || s.Plots[0].WateredAt != at {
		t.Fatal("rain should water the seedling without skipping its introduction")
	}
	for _, region := range []Region{worldMap.Meadow, worldMap.Forest, worldMap.Highland} {
		center := Vec2{(region.Bounds.MinX + region.Bounds.MaxX) / 2, (region.Bounds.MinZ + region.Bounds.MaxZ) / 2}
		if got := allowedPosition(&s, center, worldMap.Home.ReturnPoint); got != worldMap.Home.ReturnPoint {
			t.Fatalf("entered locked region %s", region.ID)
		}
		s.Regions = append(s.Regions, region.ID)
		if got := allowedPosition(&s, center, worldMap.Home.ReturnPoint); got != center {
			t.Fatalf("could not enter unlocked region %s", region.ID)
		}
	}
	s.Progression.Step = 9
	s.Discoveries = []string{"cloud"}
	for i := 0; i < 300; i++ {
		o := newOrder(&s)
		if !slices.Contains([]string{"clover", "carrot", "wool_cloud"}, o.ItemID) {
			t.Fatalf("early order requested unavailable item %s", o.ItemID)
		}
	}
}
