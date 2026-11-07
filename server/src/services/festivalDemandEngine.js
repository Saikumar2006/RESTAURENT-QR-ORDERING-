const prisma = require("../config/db");

/**
 * Indian Festival & Event Demand Intelligence Engine
 * Predicts localized category and ingredient demand surges based on cultural,
 * astronomical, sporting, and holiday calendars.
 */

// Calendar of key Indian & regional occasions with demand impact coefficients
const FESTIVAL_CALENDAR = [
  {
    name: "Makar Sankranti / Pongal / Lohri",
    dates: ["2026-01-14", "2027-01-14"],
    region: "National / South & North India",
    type: "Harvest / Cultural",
    shifts: {
      vegetarian: +40,
      sweets: +120,
      rice: +80,
      snacks: +50,
      nonVegetarian: -20,
    },
    keyDishes: ["Pongal", "Khichdi", "Til Laddoo", "Payasam", "Gajak"],
    description: "Harvest festival celebrating the sun transit. Significant surge in sweets, rice dishes, and vegetarian traditional platters.",
  },
  {
    name: "Republic Day",
    dates: ["2026-01-26", "2027-01-26"],
    region: "National Holiday",
    type: "National",
    shifts: {
      dineInVolume: +45,
      breakfast: +60,
      familyCombos: +50,
    },
    keyDishes: ["Tricolour Biryani", "Thali", "Masala Dosa", "Chole Bhature"],
    description: "National public holiday with high morning and lunchtime family dining turnout.",
  },
  {
    name: "Maha Shivratri",
    dates: ["2026-02-15", "2027-03-06"],
    region: "National",
    type: "Religious Fasting",
    shifts: {
      vegetarian: +90,
      nonVegetarian: -95,
      dairyBeverages: +110,
      fastingFoods: +150,
    },
    keyDishes: ["Sabudana Khichdi", "Thandai", "Lassi", "Paneer Dishes", "Fruit Bowls"],
    description: "Major fasting observance. Non-vegetarian sales plummet; dairy, fruit, and satvik/fasting items surge.",
  },
  {
    name: "Ramadan (Holy Month of Fasting)",
    dates: ["2026-02-18", "2027-02-08"], // Start dates; lasts ~30 days
    durationDays: 30,
    region: "National / Islamic",
    type: "Religious Fasting & Feasting",
    shifts: {
      eveningIftarDineIn: +120,
      lateNightOrders: +90,
      mutton: +80,
      chicken: +60,
      biryani: +110,
      beverages: +75,
      afternoonDineIn: -40,
    },
    keyDishes: ["Haleem", "Mutton Biryani", "Kebabs", "Rooh Afza", "Sheer Khurma", "Dates & Fruit Platters"],
    description: "Daytime dine-in slows, followed by massive evening Iftar rushes and late-night dining. High meat and biryani demand.",
  },
  {
    name: "Holi (Festival of Colours)",
    dates: ["2026-03-04", "2027-03-22"],
    region: "National",
    type: "Cultural Celebration",
    shifts: {
      sweets: +180,
      snacks: +90,
      beverages: +120,
      takeaway: +70,
    },
    keyDishes: ["Gujiya", "Thandai", "Dahi Vada", "Malpua", "Chaat"],
    description: "Joyful celebration characterized by high pre-event sweet purchases, street snacks, and refreshing cold beverages.",
  },
  {
    name: "Ugadi / Gudi Padwa",
    dates: ["2026-03-19", "2027-04-07"],
    region: "Deccan & Western India (Telangana, AP, Karnataka, Maharashtra)",
    type: "New Year Festival",
    shifts: {
      vegetarian: +60,
      sweets: +130,
      traditionalPlatters: +90,
    },
    keyDishes: ["Ugadi Pachadi", "Puran Poli", "Obbattu", "Payasam", "Festive Thali"],
    description: "Traditional New Year with high demand for vegetarian festive meals and sweet delicacies.",
  },
  {
    name: "Eid ul-Fitr",
    dates: ["2026-03-20", "2027-03-10"],
    region: "National",
    type: "Religious Celebration",
    shifts: {
      biryani: +150,
      mutton: +140,
      chicken: +100,
      sweets: +160,
      overallVolume: +80,
    },
    keyDishes: ["Dum Biryani", "Sheer Khurma", "Mutton Korma", "Seekh Kebabs", "Phirni"],
    description: "Major celebration marking the conclusion of Ramadan. Extraordinary demand for premium non-vegetarian platters and desserts.",
  },
  {
    name: "Eid al-Adha (Bakrid)",
    dates: ["2026-05-27", "2027-05-16"],
    region: "National",
    type: "Religious Celebration",
    shifts: {
      mutton: +180,
      biryani: +140,
      skewers: +90,
    },
    keyDishes: ["Mutton Biryani", "Nalli Nihari", "Boti Kebab", "Mutton Haleem"],
    description: "Feast of sacrifice with the highest annual per-table consumption of mutton specialties.",
  },
  {
    name: "Onam",
    dates: ["2026-08-26", "2027-09-12"],
    region: "Kerala / South India",
    type: "Harvest / Cultural",
    shifts: {
      vegetarian: +95,
      traditionalPlatters: +150,
      sweets: +100,
    },
    keyDishes: ["Onam Sadya", "Avial", "Sambar", "Ada Pradhaman", "Payasam"],
    description: "Grand harvest festival featuring traditional multi-course vegetarian feasts (Sadya).",
  },
  {
    name: "Ganesh Chaturthi",
    dates: ["2026-09-14", "2027-09-04"],
    region: "Maharashtra, Telangana, Karnataka, National",
    type: "Religious Celebration",
    shifts: {
      sweets: +190,
      vegetarian: +80,
      snacks: +70,
      nonVegetarian: -60,
    },
    keyDishes: ["Modak", "Puran Poli", "Sundal", "Sheera", "Sabudana Vada"],
    description: "10-day festival with massive modak and sweet confectionery demand, accompanied by vegetarian shifts.",
  },
  {
    name: "Navratri & Durga Puja (9 Nights)",
    dates: ["2026-10-11", "2027-09-30"], // 9-10 day festival
    durationDays: 10,
    region: "National",
    type: "Religious & Cultural",
    shifts: {
      vegetarian: +90,
      fastingItems: +140,
      nonVegetarian: -85,
      sweets: +110,
      lateNightDineIn: +80,
    },
    keyDishes: ["Kuttu Puri", "Singhara Halwa", "Paneer Tikka", "Bengali Sweets", "Rasgulla", "Sondesh"],
    description: "Widespread abstinence from meat across North/West India; Bengali cultural dining surges during Durga Puja with feast menus.",
  },
  {
    name: "Diwali & Dhanteras (Festival of Lights)",
    dates: ["2026-11-08", "2027-10-29"],
    durationDays: 4,
    region: "National Peak Season",
    type: "Major National Festival",
    shifts: {
      sweets: +250,
      snackGiftBoxes: +200,
      dineInVolume: +95,
      beverages: +80,
      familyCombos: +110,
    },
    keyDishes: ["Kaju Katli", "Gulab Jamun", "Motichoor Laddoo", "Festive Biryani", "Paneer Butter Masala", "Chaat Platter"],
    description: "Highest revenue period of the year for hospitality and confectioneries. Massive surge in gifts, takeaway sweets, and celebratory dining.",
  },
  {
    name: "IPL Cricket Tournament Match Days",
    dates: ["2026-04-01", "2026-05-30"],
    region: "National",
    type: "Major Sporting Event",
    shifts: {
      takeaway: +65,
      beverages: +75,
      fingerFoods: +90,
      combos: +50,
    },
    keyDishes: ["Chicken Wings", "Crispy Corn", "Loaded Fries", "Beer/Mocktail Pitchers", "Pizza/Sliders"],
    description: "Evening matches generate heavy delivery and takeaway surges for sharing platters and fast bites.",
  },
  {
    name: "New Year's Eve & Day",
    dates: ["2026-12-31", "2027-01-01"],
    region: "Global / National",
    type: "Celebration",
    shifts: {
      dineInVolume: +140,
      beverages: +150,
      nonVegetarian: +70,
      desserts: +80,
    },
    keyDishes: ["Buffet Special", "Cocktails & Mocktails", "Barbecue Platters", "Chocolate Lava Cake"],
    description: "Extreme dine-in volume with extended dining hours, group bookings, and premium culinary choices.",
  },
];

/**
 * Get upcoming festivals and occasions within a given day horizon
 */
function getUpcomingFestivals({ daysAhead = 45, referenceDate = new Date() } = {}) {
  const refTime = new Date(referenceDate).getTime();
  const maxTime = refTime + (daysAhead * 24 * 60 * 60 * 1000);
  const results = [];

  for (const fest of FESTIVAL_CALENDAR) {
    for (const dStr of fest.dates) {
      const eventTime = new Date(dStr + "T00:00:00").getTime();
      const durationMs = (fest.durationDays || 1) * 24 * 60 * 60 * 1000;
      const eventEndTime = eventTime + durationMs;

      if (eventEndTime >= refTime && eventTime <= maxTime) {
        const daysUntil = Math.ceil((eventTime - refTime) / (24 * 60 * 60 * 1000));
        results.push({
          name: fest.name,
          date: dStr,
          daysUntil: Math.max(0, daysUntil),
          region: fest.region,
          type: fest.type,
          shifts: fest.shifts,
          keyDishes: fest.keyDishes,
          description: fest.description,
        });
      }
    }
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Correlate festival demand projections with actual restaurant menu items and recipes
 */
async function analyzeEventDemand(restaurantId, { eventName = null, daysAhead = 30 } = {}) {
  const festivals = getUpcomingFestivals({ daysAhead });
  const targetEvent = eventName
    ? festivals.find((f) => f.name.toLowerCase().includes(eventName.toLowerCase()))
    : festivals[0];

  if (!targetEvent) {
    return {
      restaurantId,
      message: "No major festival detected in the selected horizon. Regular operating patterns apply.",
      upcomingEvents: festivals,
    };
  }

  // Fetch restaurant details and menu items
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, cuisineType: true },
  });

  const menuItems = await prisma.menuItem.findMany({
    where: { restaurantId, isDeleted: false, isAvailable: true },
    include: {
      category: { select: { id: true, name: true } },
      recipeComponents: {
        include: {
          inventoryItem: { select: { id: true, name: true, quantity: true, baseUnit: true } },
        },
      },
    },
  });

  const shifts = targetEvent.shifts || {};
  const ingredientImpactMap = new Map();

  const impactedMenuItems = menuItems.map((item) => {
    let multiplier = 1.0;
    const itemName = item.name.toLowerCase();
    const catName = (item.category?.name || "").toLowerCase();

    // Calculate category multiplier
    if (shifts.vegetarian && item.isVeg) multiplier *= (1 + shifts.vegetarian / 100);
    if (shifts.nonVegetarian && !item.isVeg) multiplier *= (1 + shifts.nonVegetarian / 100);
    if (shifts.sweets && (catName.includes("sweet") || catName.includes("dessert") || itemName.includes("sweet") || itemName.includes("halwa"))) {
      multiplier *= (1 + shifts.sweets / 100);
    }
    if (shifts.biryani && (itemName.includes("biryani") || catName.includes("biryani"))) {
      multiplier *= (1 + shifts.biryani / 100);
    }
    if (shifts.mutton && itemName.includes("mutton")) multiplier *= (1 + shifts.mutton / 100);
    if (shifts.chicken && itemName.includes("chicken")) multiplier *= (1 + shifts.chicken / 100);

    const projectedDemandFactor = Number(multiplier.toFixed(2));

    // Aggregate required ingredients
    if (Array.isArray(item.recipeComponents)) {
      for (const rc of item.recipeComponents) {
        if (!rc.inventoryItem) continue;
        const invId = rc.inventoryItem.id;
        const currentNeeded = ingredientImpactMap.get(invId) || {
          name: rc.inventoryItem.name,
          currentStock: rc.inventoryItem.quantity,
          unit: rc.inventoryItem.baseUnit,
          estimatedRequirementIncrease: 0,
        };
        const increasePct = (projectedDemandFactor - 1) * 100;
        currentNeeded.estimatedRequirementIncrease = Math.max(currentNeeded.estimatedRequirementIncrease, increasePct);
        ingredientImpactMap.set(invId, currentNeeded);
      }
    }

    return {
      id: item.id,
      name: item.name,
      category: item.category?.name || "General",
      isVeg: item.isVeg,
      projectedDemandFactor,
      status: projectedDemandFactor > 1.2 ? "HIGH_SURGE" : projectedDemandFactor < 0.8 ? "EXPECTED_DIP" : "NORMAL",
    };
  });

  const criticalIngredients = Array.from(ingredientImpactMap.values())
    .filter((ing) => ing.estimatedRequirementIncrease > 20)
    .map((ing) => ({
      name: ing.name,
      currentStock: ing.currentStock,
      unit: ing.unit,
      projectedSurgePercent: `+${Math.round(ing.estimatedRequirementIncrease)}%`,
      recommendation: ing.currentStock <= 10 ? "URGENT_PROCUREMENT" : "MONITOR",
    }));

  return {
    restaurantId,
    event: targetEvent,
    summary: `${targetEvent.name} is in ${targetEvent.daysUntil} days. Category shifts will impact ${impactedMenuItems.filter((m) => m.status === "HIGH_SURGE").length} menu items.`,
    impactedMenuItems: impactedMenuItems.filter((m) => m.status !== "NORMAL").slice(0, 10),
    criticalIngredients,
    preparationChecklist: [
      `Review supplier lead times for festive ingredients 48 hours prior to ${targetEvent.date}.`,
      shifts.vegetarian > 30 ? "Increase prep of vegetarian gravies, paneer, and rice bases." : null,
      shifts.nonVegetarian < -30 ? "Reduce meat orders to avoid spoilage during fasting periods." : null,
      shifts.sweets > 50 ? "Pre-package dessert gift packs and sweets boxes." : null,
      "Schedule additional floor staff during expected rush hours.",
    ].filter(Boolean),
  };
}

module.exports = {
  FESTIVAL_CALENDAR,
  INDIAN_FESTIVALS: FESTIVAL_CALENDAR,
  getUpcomingFestivals,
  analyzeEventDemand,
};
