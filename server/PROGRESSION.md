# Progressive farm contract

The room still owns one shared `FarmState`. New rooms start with **0 sheep, 0 plots, 180 coins, 2 feed**. There is no save migration or legacy bootstrap.

New fields:

```ts
progression: { step: number; forestFinds: number; lastStargazeDay: number }
buildings: { shelter: boolean; garden: boolean }
regions: ('home' | 'meadow' | 'forest' | 'highland')[]
grazing: {
  active: boolean; leaderId: string | null;
  regionId: 'home' | 'meadow' | 'forest' | 'highland';
  startedAt: number; grazeSeconds: number; watered: boolean;
  completedCount: number;
}
forageNodes: {
  id: string; regionId: 'forest'; itemId: 'mushroom' | 'herb';
  position: {x:number;z:number}; readyAt: number;
}[]
```

`step` means the current objective. Completing its action advances exactly once. Earlier care/farming actions remain usable after their introduction. Upcoming systems are rejected by the server until unlocked.

| Step | Current objective | Action / completion |
| --- | --- | --- |
| 0 | Build a home for sheep | `{type:'build',facility:'shelter'}`; first story gift is free |
| 1 | Adopt your first friend | `{type:'adopt'}`; 110 coins, guaranteed adult cloud female named 棉花糖, full wool |
| 2 | Meet her | `pet` |
| 3 | Feed her | `feed` |
| 4 | Collect the first wool | `shear` |
| 5 | Build the garden | `{type:'build',facility:'garden'}`; free story gift, creates six plots and grants three clover seeds |
| 6 | Plant clover | `plant` with `cropId:'clover'` |
| 7 | Water the seedling | `water` |
| 8 | First harvest | `harvest`; first clover order appears |
| 9 | First neighbor delivery | `order`; 3 clover → 70 coins |
| 10 | Set out to graze | `{type:'startGraze'}` at home; meadow opens |
| 11 | Pasture, spring, then home | Spend 20 active seconds in meadow target, `{type:'waterFlock'}` at spring, `{type:'finishGraze'}` at home |
| 12 | Welcome a lamb | Second adoption is available and guarantees the opposite sex; `breed` advances |
| 13 | Explore the forest | `{type:'forage',nodeId}` at three mushroom nodes; forest opens |
| 14 | Restore the highland habitat | `{type:'unlockRegion',regionId:'highland'}`; level 3, 120 coins, 3 mushroom and 3 carrot |
| 15 | Grow your collection | Regions and discovered systems remain available |

First completed grazing trip gives **180 coins** so the next sheep (110) and breeding (45) are affordable. Later trips give 25 coins. Hunger and happiness recover on return. The grazing timer advances only while the connected leader stands in the canonical meadow target; simply keeping a socket open at home does not count. The spring and return actions use the server-known player position. A disconnected leader's trip can be resumed by another member with `startGraze` at home, preserving progress.

The canonical map is `src/game/regions.json`, mirrored into the Go binary as `server/regions.json`. Home return radius, meadow target, spring, gates, region bounds, and forage positions are shared with the renderer. Forest mushroom/herb nodes yield one item and respawn after 180 seconds; `readyAt` persists. Only mushroom findings advance step 13. Mushroom sells for 12 coins and herb for 16, after introduction to the forest.

`{type:'rehome',sheepId}` humanely sends a sheep to a neighbor, without payment. Keep at least one sheep; discoveries stay in the journal. This becomes available at step 12, retaining at least one sheep. Whenever only one sheep remains, adoption guarantees the opposite sex so breeding can resume. UI asks for explicit confirmation before sending the action.

Crop gates apply to buying seeds and planting: clover 6, carrot 9, wheat 10, daisy 12, lavender 13, pumpkin 14, moonflower 15. Reaching step 9 grants three carrot seeds; reaching step 12 grants two daisy seeds. Orders only request unlocked crops or wool from discovered breeds. Rare sheep enter the pool when the forest opens, epic sheep when the highland opens, and legendary sheep additionally require level 5.

`{type:'stargaze'}` is available in the unlocked highland. The player must be within the canonical viewpoint radius at night (`dayProgress < .24 || dayProgress > .78`). Once per farm day, it grants one moonflower seed, 15 coins, and 15 XP; `progression.lastStargazeDay` persists the daily claim.

Timestamp fields remain Unix milliseconds. REST and WebSocket authentication/room membership are unchanged. All action success responses contain the complete state. The server also enforces locked-map boundaries; regions cannot be unlocked by sending a forged movement coordinate.
