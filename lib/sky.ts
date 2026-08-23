import type { ScenarioKey } from "./fast2";

export type Sky = {
  when: string;
  near: string;
  far: string;
  air: string;
};

const DELHI: Record<ScenarioKey, Sky> = {
  hotel_food: {
    when: "late morning",
    near: "dry dust at the curb, a plastic stool, a scooter tyre in sun",
    far: "open sky over the block, a DTC bus in daylight, plaster walls",
    air: "hard Delhi sun, shade under the tapri tarp, kettle steam in daylight",
  },
  market_shopping: {
    when: "late morning",
    near: "crates, tomatoes, coriander, a tarp edge",
    far: "more carts, ochre shops, a bright paper sky",
    air: "open sun on the sabzi, shade under the tarp, no night lamps",
  },
  travel_auto: {
    when: "midday",
    near: "hot asphalt, the auto's yellow-green body",
    far: "other autos, plaster shopfronts, a high pale sky",
    air: "harsh noon sun, sharp shadows, chrome glare",
  },
  travel_bus: {
    when: "afternoon",
    near: "the red DTC step, a ticket pouch in sun",
    far: "the avenue, commuters, a washed blue sky",
    air: "bright afternoon, open street, no headlights",
  },
  random_stranger: {
    when: "afternoon",
    near: "a shop awning, phone in hand, dry pavement",
    far: "the living block, scooters, daylight shopfronts",
    air: "warm afternoon, open shade, a clear sky",
  },
  police_traffic: {
    when: "afternoon",
    near: "a white-and-blue uniform, a cone, dry road",
    far: "day traffic, a pale sky, shop boards",
    air: "full daylight checkpoint, no torch, no night rain",
  },
  on_a_date: {
    when: "late afternoon",
    near: "a small café table, a glass of chai",
    far: "a sunlit window, the street still bright",
    air: "golden late day, warm wood, no rain",
  },
  school_teacher: {
    when: "morning",
    near: "a school gate, a register, a cycle",
    far: "a board, morning sky, the lane",
    air: "clear school-morning light, open courtyard",
  },
  friends_marriage: {
    when: "late afternoon",
    near: "marigold, a shamiana edge, a bright sari",
    far: "tent cloth in sun, guests, a warm sky",
    air: "late-day wedding light, marigold and gold, not night fairy-dark",
  },
  doctor_visit: {
    when: "late morning",
    near: "a clinic doorway, a white coat, a green cross",
    far: "a short queue, a bright lane",
    air: "clean daylight, clinic white, open door",
  },
};

const TOKYO: Record<ScenarioKey, Sky> = {
  hotel_food: {
    when: "early evening",
    near: "wooden stools, a noren hem, cobbles still dry",
    far: "the alley opening to a still-blue sky, one red lantern just on",
    air: "lanterns clicking on while the sky is still lit, not midnight rain",
  },
  market_shopping: {
    when: "late morning",
    near: "fruit crates, a shop apron, clean pavement",
    far: "vending machines in sun, a paper-bright sky",
    air: "clear Tokyo morning, yaoya daylight, no rain",
  },
  travel_auto: {
    when: "afternoon",
    near: "a black taxi door, dry tarmac",
    far: "the avenue, glass towers, a bright sky",
    air: "clear afternoon, hard shadows, no neon night",
  },
  travel_bus: {
    when: "afternoon",
    near: "a Toei step, a fare box in sun",
    far: "the green bus, commuters, open sky",
    air: "bright afternoon street, daylight glass",
  },
  random_stranger: {
    when: "afternoon",
    near: "a konbini doorway, dry pavement",
    far: "vending machines, a bright sky",
    air: "clear afternoon, no umbrella, no rain",
  },
  police_traffic: {
    when: "afternoon",
    near: "a koban window, a blue uniform, dry street",
    far: "bikes, a pale sky, the block",
    air: "daylight koban, no flashlight, no wet night",
  },
  on_a_date: {
    when: "afternoon",
    near: "a kissaten table, iced coffee, wood grain",
    far: "a sunlit window, the street outside still bright",
    air: "soft afternoon window light, paper and wood",
  },
  school_teacher: {
    when: "morning",
    near: "a school gate, a register, bikes",
    far: "a board, morning sky",
    air: "clear school-morning light",
  },
  friends_marriage: {
    when: "late afternoon",
    near: "a wedding-hall lantern, a kimono sleeve",
    far: "noren, a warm still-lit sky",
    air: "late-day gold, lanterns on, sky not black",
  },
  doctor_visit: {
    when: "late morning",
    near: "a clinic door, a white coat, a green cross",
    far: "a short queue, a bright lane",
    air: "clean daylight, clinic white",
  },
};

export function skyOf(cityId: string, key: ScenarioKey): Sky {
  return (cityId === "tokyo" ? TOKYO : DELHI)[key];
}

export function walkSky(cityId: string): Sky {
  return cityId === "tokyo"
    ? {
        when: "late morning",
        near: "clean pavement, a vending machine, a bicycle wheel",
        far: "the alley opening to a paper-bright sky and sunlit glass",
        air: "clear Tokyo morning sun, photoreal street, not a night scene",
      }
    : {
        when: "late morning",
        near: "dry asphalt, a scooter tyre, a plastic stool",
        far: "the block opening to a pale paper sky and sunlit plaster",
        air: "clear Delhi morning sun, photoreal street, not a night scene",
      };
}
