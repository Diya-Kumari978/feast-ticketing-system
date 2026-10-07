const EVENT_CONFIG = {
  name: "Winter Cyber FEAST'26",
  ticketPrefix: "FEAST",
  date: "15 October 2026",
  venue: "MUET Jamshoro",
  department: "Department of Computer Systems Engineering",
  footerVenue: "MUET Jamshoro · Department of Computer Systems Engineering",
  heroTagline: "Stalls · Live Bands · Food",
  price: 250,
  accounts: [
    { provider: "JazzCash", holder: "Shahnawaz", number: "03348975592" },
    { provider: "JazzCash", holder: "Muhammad Zubair Khalid", number: "03013510300" },
  ],
} as const;

export default EVENT_CONFIG;
