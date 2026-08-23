

export const FAST2_KEYS = [
  "hotel_food",
  "market_shopping",
  "travel_auto",
  "travel_bus",
  "random_stranger",
  "police_traffic",
  "on_a_date",
  "school_teacher",
  "friends_marriage",
  "doctor_visit",
] as const;

export type ScenarioKey = (typeof FAST2_KEYS)[number];

export type Fast2Scenario = {
  key: ScenarioKey;
  label: string;
  description: string;
  character: string;
};

export const FAST2: Fast2Scenario[] = [
  {
    key: "hotel_food",
    label: "Ordering Food",
    description: "Order a meal at a local restaurant or hotel.",
    character: "Waiter",
  },
  {
    key: "market_shopping",
    label: "Market Shopping",
    description: "Bargain and buy vegetables or clothes at a local market.",
    character: "Shop Keeper",
  },
  {
    key: "travel_auto",
    label: "Auto Ride",
    description: "Negotiate a fare and ride with an auto-rickshaw driver.",
    character: "Auto Driver",
  },
  {
    key: "travel_bus",
    label: "Bus Journey",
    description: "Ask for directions and buy a ticket on a local bus.",
    character: "Bus Conductor",
  },
  {
    key: "random_stranger",
    label: "Random Stranger",
    description: "Strike up a conversation with a friendly stranger on the street.",
    character: "Stranger",
  },
  {
    key: "police_traffic",
    label: "Police Traffic Stop",
    description: "A police officer stops you at a traffic checkpoint.",
    character: "Traffic Police Officer",
  },
  {
    key: "on_a_date",
    label: "On a Date",
    description: "Make conversation on a first date at a café.",
    character: "Date",
  },
  {
    key: "school_teacher",
    label: "With a Teacher",
    description: "Talk to your teacher after class about an assignment.",
    character: "Teacher",
  },
  {
    key: "friends_marriage",
    label: "Friend's Wedding",
    description: "Chat with relatives and family friends at your friend's wedding.",
    character: "Relative",
  },
  {
    key: "doctor_visit",
    label: "Doctor's Visit",
    description: "Describe your symptoms to a doctor at a clinic.",
    character: "Doctor",
  },
];
