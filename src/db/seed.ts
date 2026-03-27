/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function seed() {
  console.log("🌵 Seeding Southwest Road Trip database...");

  await db.delete(schema.locations);
  await db.delete(schema.reminders);
  await db.delete(schema.events);
  await db.delete(schema.packingItems);
  await db.delete(schema.expenses);
  await db.delete(schema.days);

  const daysData = [
    { date: "2026-04-08", dayNumber: 1, title: "Travel Day — DTW to PHX", location: "Phoenix/Scottsdale, AZ", sleepLocation: "Tom's Apt.", driveInfo: "Drive to DTW, fly DTW→PHX", notes: "", coverImageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop" },
    { date: "2026-04-09", dayNumber: 2, title: "Scottsdale Explorer Day", location: "Scottsdale, AZ", sleepLocation: "Tom's Apt.", driveInfo: "Local driving only", notes: "", coverImageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop" },
    { date: "2026-04-10", dayNumber: 3, title: "Sedona Day", location: "Sedona, AZ", sleepLocation: "Hilton Sedona", driveInfo: "Scottsdale → Sedona (~1h 45m)", notes: "", coverImageUrl: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&auto=format&fit=crop" },
    { date: "2026-04-11", dayNumber: 4, title: "Grand Canyon + Page, AZ", location: "Grand Canyon → Page → Springdale", sleepLocation: "Hilton Springdale", driveInfo: "Sedona → Grand Canyon → Page → Springdale (~7h)", notes: "", coverImageUrl: "https://images.unsplash.com/photo-1615551043360-33de8b5f410c?w=800&auto=format&fit=crop" },
    { date: "2026-04-12", dayNumber: 5, title: "Zion National Park Day", location: "Springdale, UT", sleepLocation: "Hilton Springdale", driveInfo: "Shuttle within Zion", notes: "", coverImageUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop" },
    { date: "2026-04-13", dayNumber: 6, title: "Bryce Canyon Day", location: "Bryce Canyon City, UT", sleepLocation: "Best Western", driveInfo: "Springdale → Bryce Canyon (~2h)", notes: "", coverImageUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop" },
    { date: "2026-04-14", dayNumber: 7, title: "Bryce → Bridal Veil → Provo", location: "Provo, UT", sleepLocation: "Hampton Inn Provo", driveInfo: "Bryce Canyon → Bridal Veil Falls → Provo (~3h)", notes: "", coverImageUrl: "https://images.unsplash.com/photo-1604537466608-109fa2f16c3b?w=800&auto=format&fit=crop" },
    { date: "2026-04-15", dayNumber: 8, title: "Salt Lake City Day", location: "Salt Lake City, UT", sleepLocation: "Hilton SLC", driveInfo: "Provo → SLC (~45 min)", notes: "", coverImageUrl: "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800&auto=format&fit=crop" },
    { date: "2026-04-16", dayNumber: 9, title: "Bonneville Salt Flats + Vegas Arrival", location: "SLC → Bonneville → Las Vegas", sleepLocation: "Hampton Inn Las Vegas", driveInfo: "SLC → Bonneville → Las Vegas (~7h 15m)", notes: "", coverImageUrl: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&auto=format&fit=crop" },
    { date: "2026-04-17", dayNumber: 10, title: "Vegas Day + Hoover Dam + Scottsdale", location: "Las Vegas → Scottsdale", sleepLocation: "Tom's Apt.", driveInfo: "Vegas → Hoover Dam → Scottsdale (~5h)", notes: "", coverImageUrl: "https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d?w=800&auto=format&fit=crop" },
    { date: "2026-04-18", dayNumber: 11, title: "Fly Home", location: "PHX → DTW", sleepLocation: "Home", driveInfo: "Drive to PHX Airport", notes: "Leave Tom's by 4:15 AM!", coverImageUrl: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&auto=format&fit=crop" },
  ];

  const insertedDays = await db.insert(schema.days).values(daysData).returning();
  console.log(`✅ Inserted ${insertedDays.length} days`);
  const dayMap = new Map(insertedDays.map((d) => [d.dayNumber, d.id]));

  const eventsData: schema.NewEvent[] = [
    // Day 1
    { dayId: dayMap.get(1)!, title: "Drive to Airport (DTW)", startTime: "12:00", endTime: "13:00", category: "drive", location: "Detroit, MI", tip: "", cost: "0", isBooked: false, sortOrder: 1 },
    { dayId: dayMap.get(1)!, title: "TSA / Pre-Flight", startTime: "13:00", endTime: "16:15", category: "other", location: "DTW Airport", tip: "", cost: "0", isBooked: false, sortOrder: 2 },
    { dayId: dayMap.get(1)!, title: "Boarding DL1135", startTime: "16:15", endTime: "16:55", category: "flight", location: "DTW Gate", tip: "", cost: "0", isBooked: true, sortOrder: 3 },
    { dayId: dayMap.get(1)!, title: "Flight DL1135 DTW→PHX", startTime: "16:55", endTime: "18:18", category: "flight", location: "In Air", tip: "DL1135 departs 4:55 PM, arrives 6:18 PM PHX", cost: "0", isBooked: true, sortOrder: 4 },
    { dayId: dayMap.get(1)!, title: "Deplane + Baggage", startTime: "18:18", endTime: "18:45", category: "flight", location: "PHX Airport", tip: "", cost: "0", isBooked: false, sortOrder: 5 },
    { dayId: dayMap.get(1)!, title: "Pick Up Enterprise Rental Car", startTime: "18:45", endTime: "19:15", category: "drive", location: "PHX Airport Enterprise", tip: "Confirm reservation ahead, have license and credit card ready", cost: "0", isBooked: true, sortOrder: 6 },
    { dayId: dayMap.get(1)!, title: "Drive to Tom's Apartment", startTime: "19:15", endTime: "19:45", category: "drive", location: "Scottsdale, AZ", tip: "", cost: "0", isBooked: false, sortOrder: 7 },
    { dayId: dayMap.get(1)!, title: "Dinner — In-N-Out or Scottsdale", startTime: "20:00", endTime: "21:30", category: "food", location: "Scottsdale, AZ", tip: "Welcome to Arizona!", cost: "30", isBooked: false, sortOrder: 8 },
    // Day 2
    { dayId: dayMap.get(2)!, title: "Sleep In", startTime: "06:00", endTime: "09:00", category: "other", location: "Tom's Apt.", tip: "", cost: "0", isBooked: false, sortOrder: 1 },
    { dayId: dayMap.get(2)!, title: "Get Ready", startTime: "09:00", endTime: "09:45", category: "other", location: "Tom's Apt.", tip: "", cost: "0", isBooked: false, sortOrder: 2 },
    { dayId: dayMap.get(2)!, title: "Dutch Bros & Breakfast (Old Town)", startTime: "10:00", endTime: "11:00", category: "food", location: "Old Town Scottsdale", tip: "Must try Dutch Bros — Arizona original!", cost: "20", isBooked: false, sortOrder: 3 },
    { dayId: dayMap.get(2)!, title: "Explore Old Town Scottsdale", startTime: "11:00", endTime: "13:30", category: "sightseeing", location: "Old Town Scottsdale", tip: "", cost: "0", isBooked: false, sortOrder: 4 },
    { dayId: dayMap.get(2)!, title: "Lunch in Scottsdale", startTime: "13:30", endTime: "14:30", category: "food", location: "Scottsdale, AZ", tip: "", cost: "25", isBooked: false, sortOrder: 5 },
    { dayId: dayMap.get(2)!, title: "Starbucks City Mug Hunt", startTime: "14:30", endTime: "15:00", category: "shopping", location: "Starbucks Scottsdale", tip: "Get the Scottsdale/Arizona city mug", cost: "20", isBooked: false, sortOrder: 6 },
    { dayId: dayMap.get(2)!, title: "Grocery Shop — snacks for trip", startTime: "15:00", endTime: "17:00", category: "shopping", location: "Scottsdale Grocery Store", tip: "Stock up: PB&J, chips, granola bars, Liquid IV, Chomps", cost: "80", isBooked: false, sortOrder: 7 },
    { dayId: dayMap.get(2)!, title: "Dinner in Old Town", startTime: "18:30", endTime: "20:30", category: "food", location: "Old Town Scottsdale", tip: "", cost: "50", isBooked: false, sortOrder: 8 },
    { dayId: dayMap.get(2)!, title: "Night In", startTime: "20:30", endTime: "23:59", category: "other", location: "Tom's Apt.", tip: "", cost: "0", isBooked: false, sortOrder: 9 },
    // Day 3
    { dayId: dayMap.get(3)!, title: "Wake Up", startTime: "06:00", endTime: "06:30", category: "other", location: "Tom's Apt.", tip: "", cost: "0", isBooked: false, sortOrder: 1 },
    { dayId: dayMap.get(3)!, title: "Pack", startTime: "06:30", endTime: "07:00", category: "other", location: "Tom's Apt.", tip: "", cost: "0", isBooked: false, sortOrder: 2 },
    { dayId: dayMap.get(3)!, title: "Drive Scottsdale → Sedona (~1h 45m)", startTime: "07:00", endTime: "09:00", category: "drive", location: "AZ-179", tip: "", cost: "0", isBooked: false, sortOrder: 3 },
    { dayId: dayMap.get(3)!, title: "Sedonuts", startTime: "09:00", endTime: "09:30", category: "food", location: "Sedonuts, Sedona", tip: "Get there early — they sell out! Cash only, worth the wait.", cost: "15", isBooked: false, sortOrder: 4 },
    { dayId: dayMap.get(3)!, title: "Sugar Loaf Loop Hike (1.9 mi easy)", startTime: "09:45", endTime: "11:15", category: "hike", location: "Sugar Loaf Loop Trailhead, Sedona", tip: "Can park at Tracup Trail trailhead lot. Great warm-up hike.", cost: "0", isBooked: false, sortOrder: 5 },
    { dayId: dayMap.get(3)!, title: "Lunch — Secret Garden Cafe / Hideaway House", startTime: "11:30", endTime: "12:30", category: "food", location: "Tlaquepaque, Sedona", tip: "Secret Garden Cafe is inside Tlaquepaque", cost: "30", isBooked: false, sortOrder: 6 },
    { dayId: dayMap.get(3)!, title: "Tlaquepaque Arts & Crafts Village", startTime: "12:45", endTime: "14:00", category: "shopping", location: "Tlaquepaque, Sedona", tip: "", cost: "0", isBooked: false, sortOrder: 7 },
    { dayId: dayMap.get(3)!, title: "Uptown Sedona Shopping", startTime: "14:15", endTime: "15:45", category: "shopping", location: "Uptown Sedona", tip: "", cost: "0", isBooked: false, sortOrder: 8 },
    { dayId: dayMap.get(3)!, title: "Dinner — Sedona Beer Co. / The Hudson / Cowboy Club", startTime: "16:00", endTime: "17:30", category: "food", location: "Sedona, AZ", tip: "", cost: "50", isBooked: false, sortOrder: 9 },
    { dayId: dayMap.get(3)!, title: "Airport Mesa Sunset Hike (3.5 mi)", startTime: "18:00", endTime: "20:00", category: "hike", location: "Airport Mesa Trailhead, Sedona", tip: "From 89A/179 intersection, go 1.1 miles west on 89A, left on Airport Rd", cost: "0", isBooked: false, sortOrder: 10 },
    { dayId: dayMap.get(3)!, title: "Stargazing at Thunder Mountain Trailhead", startTime: "20:15", endTime: "21:15", category: "sightseeing", location: "Thunder Mountain Trailhead, Sedona", tip: "", cost: "0", isBooked: false, sortOrder: 11 },
    { dayId: dayMap.get(3)!, title: "Drive to Hotel / Night In", startTime: "21:30", endTime: "23:59", category: "other", location: "Hilton Sedona", tip: "", cost: "0", isBooked: true, sortOrder: 12 },
    // Day 4
    { dayId: dayMap.get(4)!, title: "Wake Up", startTime: "05:30", endTime: "06:00", category: "other", location: "Hilton Sedona", tip: "", cost: "0", isBooked: false, sortOrder: 1 },
    { dayId: dayMap.get(4)!, title: "Cathedral Rock or Bell Rock Hike (1.2 mi)", startTime: "06:00", endTime: "07:30", category: "hike", location: "Cathedral Rock Trailhead, Sedona", tip: "Park at Verde Valley School Road trailhead. Start at 6:30 AM before shuttle required.", cost: "0", isBooked: false, sortOrder: 2 },
    { dayId: dayMap.get(4)!, title: "Breakfast — Wildcraft Kitchen / FreeForm Coffee", startTime: "07:30", endTime: "08:30", category: "food", location: "Sedona, AZ", tip: "", cost: "20", isBooked: false, sortOrder: 3 },
    { dayId: dayMap.get(4)!, title: "Drive Sedona → Grand Canyon South Rim (~2h 15m)", startTime: "08:30", endTime: "10:45", category: "drive", location: "AZ-89", tip: "", cost: "0", isBooked: false, sortOrder: 4 },
    { dayId: dayMap.get(4)!, title: "Grand Canyon — Mather Point + Rim Trail", startTime: "11:00", endTime: "13:00", category: "sightseeing", location: "Grand Canyon South Rim, AZ", tip: "See Lookout Studio, The Abyss, Pima Point. America the Beautiful Pass works here!", cost: "0", isBooked: false, sortOrder: 5 },
    { dayId: dayMap.get(4)!, title: "Lunch (packed or Grand Canyon Lodge)", startTime: "13:00", endTime: "13:30", category: "food", location: "Grand Canyon", tip: "", cost: "20", isBooked: false, sortOrder: 6 },
    { dayId: dayMap.get(4)!, title: "Drive Grand Canyon → Page, AZ (~2h 30m)", startTime: "13:30", endTime: "16:00", category: "drive", location: "US-89", tip: "", cost: "0", isBooked: false, sortOrder: 7 },
    { dayId: dayMap.get(4)!, title: "Antelope Canyon Tour", startTime: "16:00", endTime: "17:30", category: "sightseeing", location: "Antelope Canyon, Page, AZ", tip: "Book WELL in advance at antelopecanyon.com. Upper Canyon = famous light beams. $8 Navajo permit + tour fee.", cost: "80", isBooked: false, sortOrder: 8 },
    { dayId: dayMap.get(4)!, title: "Drive to Horseshoe Bend", startTime: "18:00", endTime: "18:30", category: "drive", location: "Page, AZ", tip: "", cost: "0", isBooked: false, sortOrder: 9 },
    { dayId: dayMap.get(4)!, title: "Horseshoe Bend at Sunset", startTime: "19:00", endTime: "20:00", category: "sightseeing", location: "Horseshoe Bend, Page, AZ", tip: "$10/car parking. Spot behind Shell Gas Station when first entering Page.", cost: "10", isBooked: false, sortOrder: 10 },
    { dayId: dayMap.get(4)!, title: "Dinner — Big John's BBQ (Page)", startTime: "20:15", endTime: "21:15", category: "food", location: "Page, AZ", tip: "", cost: "30", isBooked: false, sortOrder: 11 },
    { dayId: dayMap.get(4)!, title: "Drive Page → Springdale (~2h 20m)", startTime: "21:30", endTime: "23:59", category: "drive", location: "US-89 → UT-9", tip: "", cost: "0", isBooked: false, sortOrder: 12 },
    // Day 5
    { dayId: dayMap.get(5)!, title: "Wake Up", startTime: "06:15", endTime: "06:40", category: "other", location: "Hilton Springdale", tip: "", cost: "0", isBooked: false, sortOrder: 1 },
    { dayId: dayMap.get(5)!, title: "Breakfast — Canyon Coffee (Springdale)", startTime: "06:45", endTime: "07:00", category: "food", location: "Springdale, UT", tip: "", cost: "15", isBooked: false, sortOrder: 2 },
    { dayId: dayMap.get(5)!, title: "Walk to Zion Shuttle Stop", startTime: "07:15", endTime: "08:00", category: "other", location: "Springdale, UT", tip: "", cost: "0", isBooked: false, sortOrder: 3 },
    { dayId: dayMap.get(5)!, title: "Shuttle to The Grotto (Stop 6)", startTime: "08:00", endTime: "08:30", category: "other", location: "Zion National Park", tip: "$35/vehicle park entry or use America the Beautiful Pass. Shuttle runs from Springdale.", cost: "0", isBooked: false, sortOrder: 4 },
    { dayId: dayMap.get(5)!, title: "Scout Lookout / West Rim Trail Hike (3.8 mi RT)", startTime: "08:30", endTime: "12:00", category: "hike", location: "Zion National Park", tip: "NO permit needed! Angels Landing requires permit — Scout Lookout has nearly identical views. Start by 7 AM.", cost: "0", isBooked: false, sortOrder: 5 },
    { dayId: dayMap.get(5)!, title: "Lunch — Castle Dome Cafe or packed", startTime: "12:00", endTime: "13:00", category: "food", location: "Zion National Park", tip: "", cost: "20", isBooked: false, sortOrder: 6 },
    { dayId: dayMap.get(5)!, title: "Canyon Overlook Trail (1 mi, easy)", startTime: "13:30", endTime: "14:30", category: "hike", location: "Zion National Park", tip: "Great views, short and easy. Totally worth it.", cost: "0", isBooked: false, sortOrder: 7 },
    { dayId: dayMap.get(5)!, title: "Drive Mount Carmel Hwy / Checkerboard Mesa", startTime: "14:45", endTime: "15:30", category: "sightseeing", location: "Zion-Mt Carmel Highway", tip: "", cost: "0", isBooked: false, sortOrder: 8 },
    { dayId: dayMap.get(5)!, title: "Shuttle Back to Springdale", startTime: "15:30", endTime: "16:00", category: "other", location: "Zion National Park", tip: "", cost: "0", isBooked: false, sortOrder: 9 },
    { dayId: dayMap.get(5)!, title: "Rest / Explore Springdale", startTime: "16:00", endTime: "18:00", category: "other", location: "Springdale, UT", tip: "", cost: "0", isBooked: false, sortOrder: 10 },
    { dayId: dayMap.get(5)!, title: "Dinner — Whiptail Grill or Zion Canyon Brew Pub", startTime: "18:00", endTime: "19:30", category: "food", location: "Springdale, UT", tip: "", cost: "40", isBooked: false, sortOrder: 11 },
    { dayId: dayMap.get(5)!, title: "Night In", startTime: "19:30", endTime: "23:59", category: "other", location: "Hilton Springdale", tip: "", cost: "0", isBooked: false, sortOrder: 12 },
    // Day 6
    { dayId: dayMap.get(6)!, title: "Wake Up", startTime: "07:00", endTime: "07:30", category: "other", location: "Hilton Springdale", tip: "", cost: "0", isBooked: false, sortOrder: 1 },
    { dayId: dayMap.get(6)!, title: "Breakfast — Oscar's Cafe or Deep Creek Coffee", startTime: "07:30", endTime: "08:30", category: "food", location: "Springdale, UT", tip: "", cost: "20", isBooked: false, sortOrder: 2 },
    { dayId: dayMap.get(6)!, title: "Drive Springdale → Bryce Canyon (~2h)", startTime: "08:30", endTime: "10:30", category: "drive", location: "UT-9 → US-89 → UT-12", tip: "", cost: "0", isBooked: false, sortOrder: 3 },
    { dayId: dayMap.get(6)!, title: "Arrive Bryce / Check In Hotel", startTime: "10:30", endTime: "11:00", category: "accommodation", location: "Best Western Bryce", tip: "", cost: "0", isBooked: true, sortOrder: 4 },
    { dayId: dayMap.get(6)!, title: "Queen's Garden + Navajo Loop Combo Hike (3 mi)", startTime: "11:00", endTime: "14:00", category: "hike", location: "Bryce Canyon National Park", tip: "Start Sunrise Point, exit Sunset Point — counter-clockwise! See Thor's Hammer, Two Bridges, hoodoos.", cost: "0", isBooked: false, sortOrder: 5 },
    { dayId: dayMap.get(6)!, title: "Lunch — Valhalla Pizzeria / The Shop", startTime: "14:00", endTime: "15:00", category: "food", location: "Bryce Canyon City, UT", tip: "", cost: "25", isBooked: false, sortOrder: 6 },
    { dayId: dayMap.get(6)!, title: "Fairyland Point Overlook", startTime: "15:15", endTime: "16:00", category: "sightseeing", location: "Fairyland Point, Bryce Canyon", tip: "", cost: "0", isBooked: false, sortOrder: 7 },
    { dayId: dayMap.get(6)!, title: "Rest / Break", startTime: "16:00", endTime: "17:30", category: "other", location: "Best Western Bryce", tip: "", cost: "0", isBooked: false, sortOrder: 8 },
    { dayId: dayMap.get(6)!, title: "Rim Trail Sunset Walk", startTime: "17:30", endTime: "19:30", category: "hike", location: "Bryce Canyon Rim Trail", tip: "Bryce Canyon sits at 8,000 ft — pack layers! Cold mornings in April.", cost: "0", isBooked: false, sortOrder: 9 },
    { dayId: dayMap.get(6)!, title: "Dinner — Showdowns", startTime: "19:30", endTime: "21:00", category: "food", location: "Bryce Canyon City, UT", tip: "", cost: "35", isBooked: false, sortOrder: 10 },
    { dayId: dayMap.get(6)!, title: "Night In", startTime: "21:00", endTime: "23:59", category: "other", location: "Best Western Bryce", tip: "", cost: "0", isBooked: false, sortOrder: 11 },
    // Day 7
    { dayId: dayMap.get(7)!, title: "Wake Up", startTime: "07:00", endTime: "07:30", category: "other", location: "Best Western Bryce", tip: "", cost: "0", isBooked: false, sortOrder: 1 },
    { dayId: dayMap.get(7)!, title: "Coffee — Peace on Earth Coffee", startTime: "07:30", endTime: "08:15", category: "food", location: "Bryce Canyon City, UT", tip: "", cost: "10", isBooked: false, sortOrder: 2 },
    { dayId: dayMap.get(7)!, title: "Morning Hike — Mossy Cave Trail or Peek-a-Boo Loop", startTime: "08:30", endTime: "11:00", category: "hike", location: "Bryce Canyon National Park", tip: "", cost: "0", isBooked: false, sortOrder: 3 },
    { dayId: dayMap.get(7)!, title: "Drive to Bryce Point (views)", startTime: "11:00", endTime: "11:30", category: "drive", location: "Bryce Point, UT", tip: "", cost: "0", isBooked: false, sortOrder: 4 },
    { dayId: dayMap.get(7)!, title: "Pack / Check Out", startTime: "11:30", endTime: "15:00", category: "other", location: "Best Western Bryce", tip: "", cost: "0", isBooked: false, sortOrder: 5 },
    { dayId: dayMap.get(7)!, title: "Drive Bryce Canyon → Bridal Veil Falls", startTime: "15:00", endTime: "15:45", category: "drive", location: "US-89 → US-6", tip: "", cost: "0", isBooked: false, sortOrder: 6 },
    { dayId: dayMap.get(7)!, title: "Bridal Veil Falls (short walk)", startTime: "15:45", endTime: "16:00", category: "sightseeing", location: "Bridal Veil Falls, UT", tip: "Quick scenic stop near Provo on the way", cost: "0", isBooked: false, sortOrder: 7 },
    { dayId: dayMap.get(7)!, title: "Swig Stop (on the road)", startTime: "16:00", endTime: "16:45", category: "food", location: "Swig, UT", tip: "Utah's famous soda shop chain", cost: "10", isBooked: false, sortOrder: 8 },
    { dayId: dayMap.get(7)!, title: "Drive → Provo / Check In", startTime: "17:00", endTime: "17:45", category: "drive", location: "Hampton Inn Provo", tip: "", cost: "0", isBooked: true, sortOrder: 9 },
    { dayId: dayMap.get(7)!, title: "BYU Creamery on 9th", startTime: "18:00", endTime: "20:00", category: "food", location: "BYU Creamery, Provo", tip: "Utah institution — huge portions of ice cream & baked goods!", cost: "20", isBooked: false, sortOrder: 10 },
    { dayId: dayMap.get(7)!, title: "Explore Provo / Dinner", startTime: "20:00", endTime: "23:59", category: "food", location: "Provo, UT", tip: "", cost: "40", isBooked: false, sortOrder: 11 },
    // Day 8
    { dayId: dayMap.get(8)!, title: "Wake Up", startTime: "07:30", endTime: "08:00", category: "other", location: "Hampton Inn Provo", tip: "", cost: "0", isBooked: false, sortOrder: 1 },
    { dayId: dayMap.get(8)!, title: "Breakfast — Bianca's La Petite / Chubby Baker Donuts", startTime: "08:00", endTime: "09:00", category: "food", location: "Provo, UT", tip: "", cost: "20", isBooked: false, sortOrder: 2 },
    { dayId: dayMap.get(8)!, title: "Drive Provo → Salt Lake City (~45 min)", startTime: "09:00", endTime: "09:45", category: "drive", location: "I-15 N", tip: "", cost: "0", isBooked: false, sortOrder: 3 },
    { dayId: dayMap.get(8)!, title: "The Great Saltair Visit", startTime: "10:00", endTime: "11:00", category: "sightseeing", location: "The Great Saltair, UT", tip: "Historic pavilion on the shores of Great Salt Lake", cost: "0", isBooked: false, sortOrder: 4 },
    { dayId: dayMap.get(8)!, title: "Ensign Peak Hike (panoramic SLC views, ~1 mi)", startTime: "11:15", endTime: "12:15", category: "hike", location: "Ensign Peak, SLC", tip: "Short 1-mi hike with stunning city panorama. Free.", cost: "0", isBooked: false, sortOrder: 5 },
    { dayId: dayMap.get(8)!, title: "Lunch — Ruth's Diner", startTime: "12:30", endTime: "13:45", category: "food", location: "Ruth's Diner, SLC", tip: "", cost: "30", isBooked: false, sortOrder: 6 },
    { dayId: dayMap.get(8)!, title: "City Creek Center / The Gateway Shopping", startTime: "14:00", endTime: "16:00", category: "shopping", location: "City Creek Center, SLC", tip: "", cost: "0", isBooked: false, sortOrder: 7 },
    { dayId: dayMap.get(8)!, title: "Starbucks City Mug Hunt — Salt Lake City", startTime: "16:00", endTime: "16:30", category: "shopping", location: "Starbucks SLC", tip: "", cost: "20", isBooked: false, sortOrder: 8 },
    { dayId: dayMap.get(8)!, title: "RubySnap Cookies", startTime: "16:30", endTime: "17:00", category: "food", location: "RubySnap, SLC", tip: "", cost: "15", isBooked: false, sortOrder: 9 },
    { dayId: dayMap.get(8)!, title: "Check In Hotel / Rest", startTime: "17:00", endTime: "18:30", category: "accommodation", location: "Hilton SLC", tip: "", cost: "0", isBooked: true, sortOrder: 10 },
    { dayId: dayMap.get(8)!, title: "Dinner — Slackwater Pizza / Settebello / Red Rock Brewery", startTime: "18:30", endTime: "20:30", category: "food", location: "Salt Lake City, UT", tip: "", cost: "50", isBooked: false, sortOrder: 11 },
    { dayId: dayMap.get(8)!, title: "BTG Wine Bar", startTime: "20:30", endTime: "22:30", category: "entertainment", location: "BTG Wine Bar, SLC", tip: "Great spot to cap the night in SLC", cost: "40", isBooked: false, sortOrder: 12 },
    { dayId: dayMap.get(8)!, title: "Night In", startTime: "22:30", endTime: "23:59", category: "other", location: "Hilton SLC", tip: "", cost: "0", isBooked: false, sortOrder: 13 },
    // Day 9
    { dayId: dayMap.get(9)!, title: "Wake Up", startTime: "07:00", endTime: "07:30", category: "other", location: "Hilton SLC", tip: "", cost: "0", isBooked: false, sortOrder: 1 },
    { dayId: dayMap.get(9)!, title: "Breakfast — Penny Ann's Cafe", startTime: "07:30", endTime: "08:30", category: "food", location: "SLC, UT", tip: "", cost: "20", isBooked: false, sortOrder: 2 },
    { dayId: dayMap.get(9)!, title: "Coffee — Bjorn's Brew / Sugar House Coffee / Loki Coffee", startTime: "08:30", endTime: "09:00", category: "food", location: "SLC, UT", tip: "", cost: "10", isBooked: false, sortOrder: 3 },
    { dayId: dayMap.get(9)!, title: "Drive SLC → Bonneville Salt Flats (~1.5 hrs)", startTime: "09:00", endTime: "10:30", category: "drive", location: "I-80 W", tip: "", cost: "0", isBooked: false, sortOrder: 4 },
    { dayId: dayMap.get(9)!, title: "Bonneville Salt Flats — walk, photos", startTime: "10:30", endTime: "11:30", category: "sightseeing", location: "Bonneville Salt Flats, UT", tip: "⚠️ April may have flooding — creates stunning mirror effect! Free to visit. Take I-80 West, Exit 4. Check BLM site before driving on flats.", cost: "0", isBooked: false, sortOrder: 5 },
    { dayId: dayMap.get(9)!, title: "Drive Bonneville → Las Vegas (~7h 15m total from SLC)", startTime: "11:30", endTime: "18:30", category: "drive", location: "I-80 → I-15 S", tip: "", cost: "0", isBooked: false, sortOrder: 6 },
    { dayId: dayMap.get(9)!, title: "Check In Hotel Las Vegas", startTime: "18:30", endTime: "19:00", category: "accommodation", location: "Hampton Inn Las Vegas", tip: "", cost: "0", isBooked: true, sortOrder: 7 },
    { dayId: dayMap.get(9)!, title: "Vegas Strip Walk & Explore", startTime: "19:00", endTime: "20:00", category: "sightseeing", location: "Las Vegas Strip", tip: "", cost: "0", isBooked: false, sortOrder: 8 },
    { dayId: dayMap.get(9)!, title: "Dinner on the Strip", startTime: "20:00", endTime: "21:30", category: "food", location: "Las Vegas Strip", tip: "", cost: "60", isBooked: false, sortOrder: 9 },
    { dayId: dayMap.get(9)!, title: "Bellagio Fountains (evening show)", startTime: "21:30", endTime: "22:00", category: "sightseeing", location: "Bellagio Hotel, Las Vegas", tip: "Runs every 15–30 min. Free. Catch one at start and end of evening.", cost: "0", isBooked: false, sortOrder: 10 },
    { dayId: dayMap.get(9)!, title: "Casino / Night Out", startTime: "22:00", endTime: "23:59", category: "entertainment", location: "Las Vegas", tip: "", cost: "100", isBooked: false, sortOrder: 11 },
    // Day 10
    { dayId: dayMap.get(10)!, title: "Wake Up", startTime: "08:00", endTime: "08:30", category: "other", location: "Hampton Inn Las Vegas", tip: "", cost: "0", isBooked: false, sortOrder: 1 },
    { dayId: dayMap.get(10)!, title: "Breakfast (hotel or Strip cafe)", startTime: "08:30", endTime: "09:30", category: "food", location: "Las Vegas", tip: "", cost: "25", isBooked: false, sortOrder: 2 },
    { dayId: dayMap.get(10)!, title: "Bellagio Fountains (morning show)", startTime: "09:30", endTime: "10:00", category: "sightseeing", location: "Bellagio Hotel, Las Vegas", tip: "", cost: "0", isBooked: false, sortOrder: 3 },
    { dayId: dayMap.get(10)!, title: "Vegas Strip Walk & Shopping — Crystals, Forum Shops", startTime: "10:00", endTime: "12:00", category: "shopping", location: "Las Vegas Strip", tip: "", cost: "0", isBooked: false, sortOrder: 4 },
    { dayId: dayMap.get(10)!, title: "Lunch on the Strip", startTime: "12:00", endTime: "13:00", category: "food", location: "Las Vegas Strip", tip: "", cost: "30", isBooked: false, sortOrder: 5 },
    { dayId: dayMap.get(10)!, title: "Drive Vegas → Hoover Dam (~35 min)", startTime: "13:00", endTime: "13:40", category: "drive", location: "US-93 S", tip: "", cost: "0", isBooked: false, sortOrder: 6 },
    { dayId: dayMap.get(10)!, title: "Hoover Dam Visit", startTime: "13:45", endTime: "15:15", category: "sightseeing", location: "Hoover Dam, NV/AZ", tip: "$10/vehicle parking. Free to walk across dam. Tours of interior available.", cost: "10", isBooked: false, sortOrder: 7 },
    { dayId: dayMap.get(10)!, title: "Drive Hoover Dam → Scottsdale (~4h)", startTime: "15:15", endTime: "19:15", category: "drive", location: "US-93 → AZ-93", tip: "", cost: "0", isBooked: false, sortOrder: 8 },
    { dayId: dayMap.get(10)!, title: "Dinner in Scottsdale", startTime: "19:30", endTime: "21:00", category: "food", location: "Scottsdale, AZ", tip: "Final dinner of the trip!", cost: "60", isBooked: false, sortOrder: 9 },
    { dayId: dayMap.get(10)!, title: "Night In (Tom's Apt.)", startTime: "21:00", endTime: "23:59", category: "accommodation", location: "Tom's Apt.", tip: "", cost: "0", isBooked: false, sortOrder: 10 },
    // Day 11
    { dayId: dayMap.get(11)!, title: "Wake Up / Final Pack", startTime: "03:45", endTime: "04:15", category: "other", location: "Tom's Apt.", tip: "⚠️ Leave Tom's by 4:15 AM", cost: "0", isBooked: false, sortOrder: 1 },
    { dayId: dayMap.get(11)!, title: "Drive to PHX Airport (~30 min)", startTime: "04:15", endTime: "04:45", category: "drive", location: "PHX Sky Harbor Airport", tip: "", cost: "0", isBooked: false, sortOrder: 2 },
    { dayId: dayMap.get(11)!, title: "Return Rental Car / TSA", startTime: "04:45", endTime: "05:40", category: "other", location: "PHX Airport Enterprise", tip: "TSA PreCheck recommended. Check-in opens ~4:10 AM.", cost: "0", isBooked: false, sortOrder: 3 },
    { dayId: dayMap.get(11)!, title: "Boarding DL0947", startTime: "05:40", endTime: "06:10", category: "flight", location: "PHX Gate", tip: "", cost: "0", isBooked: true, sortOrder: 4 },
    { dayId: dayMap.get(11)!, title: "Flight DL0947 PHX→DTW", startTime: "06:10", endTime: "12:50", category: "flight", location: "In Air", tip: "", cost: "0", isBooked: true, sortOrder: 5 },
    { dayId: dayMap.get(11)!, title: "Arrive Detroit (DTW)", startTime: "12:50", endTime: "13:15", category: "flight", location: "DTW Airport", tip: "", cost: "0", isBooked: false, sortOrder: 6 },
    { dayId: dayMap.get(11)!, title: "Drive Home", startTime: "13:15", endTime: "14:30", category: "drive", location: "Detroit, MI", tip: "", cost: "0", isBooked: false, sortOrder: 7 },
  ];

  const insertedEvents = await db.insert(schema.events).values(eventsData).returning();
  console.log(`✅ Inserted ${insertedEvents.length} events`);

  const expensesData: schema.NewExpense[] = [
    { category: "flights", description: "Delta Flights (DL1135 + DL0947)", amount: "777.62", isBooked: true, isPaid: true },
    { category: "rental_car", description: "Enterprise Rental Car", amount: "543.36", isBooked: true, isPaid: false },
    { category: "hotels", description: "Springdale Hilton Hotel", amount: "702.51", isBooked: true, isPaid: false },
    { category: "hotels", description: "Sedona Hilton Hotel", amount: "378.22", isBooked: true, isPaid: false },
    { category: "hotels", description: "Bryce City Best Western Hotel", amount: "229.78", isBooked: true, isPaid: false },
    { category: "hotels", description: "SLC Home2 Hotel", amount: "161.71", isBooked: true, isPaid: false },
    { category: "hotels", description: "Vegas Hampton Inn Hotel", amount: "158.64", isBooked: true, isPaid: false },
    { category: "hotels", description: "Provo Hampton Inn Hotel", amount: "139.47", isBooked: true, isPaid: false },
    { category: "gear", description: "DJI Drone", amount: "327.54", isBooked: true, isPaid: true },
    { category: "gear", description: "Drone Accessories", amount: "18.01", isBooked: true, isPaid: true },
    { category: "gear", description: "Tripod & Backpack Straps", amount: "45.55", isBooked: true, isPaid: true },
    { category: "activities", description: "America the Beautiful Pass", amount: "87.50", isBooked: true, isPaid: true },
  ];

  const insertedExpenses = await db.insert(schema.expenses).values(expensesData).returning();
  console.log(`✅ Inserted ${insertedExpenses.length} expenses`);

  const packingData: schema.NewPackingItem[] = [
    { category: "documents", name: "Passports / IDs", quantity: 2, isPacked: false, isEssential: true, notes: "" },
    { category: "documents", name: "Flight confirmations printout", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "documents", name: "Hotel confirmations", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "documents", name: "Enterprise rental car reservation", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "documents", name: "America the Beautiful Pass", quantity: 1, isPacked: false, isEssential: true, notes: "Covers Zion, Bryce, Grand Canyon — $87.50 total saves a ton" },
    { category: "documents", name: "Credit cards + cash", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "documents", name: "Insurance cards", quantity: 2, isPacked: false, isEssential: true, notes: "" },
    { category: "documents", name: "Boarding passes (digital on phone)", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "electronics", name: "DJI Drone + batteries (x3)", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "electronics", name: "Drone accessories kit", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "electronics", name: "Drone ND filter set", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "electronics", name: "Phone chargers", quantity: 2, isPacked: false, isEssential: true, notes: "" },
    { category: "electronics", name: "Portable battery pack (20,000 mAh min)", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "electronics", name: "Tripod + backpack straps", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "electronics", name: "Camera or GoPro", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "electronics", name: "Laptop (optional)", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "electronics", name: "Car charging adapter", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "electronics", name: "Headphones", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "electronics", name: "Bluetooth speaker", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "clothing", name: "Hiking pants/shorts", quantity: 4, isPacked: false, isEssential: true, notes: "" },
    { category: "clothing", name: "Moisture-wicking shirts", quantity: 5, isPacked: false, isEssential: true, notes: "" },
    { category: "clothing", name: "Warm base layer / fleece", quantity: 1, isPacked: false, isEssential: true, notes: "Bryce Canyon is at 8,000 ft — cold even in April!" },
    { category: "clothing", name: "Rain jacket / windbreaker", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "clothing", name: "Casual dinner outfit", quantity: 2, isPacked: false, isEssential: false, notes: "" },
    { category: "clothing", name: "Underwear", quantity: 8, isPacked: false, isEssential: true, notes: "" },
    { category: "clothing", name: "Hiking socks", quantity: 6, isPacked: false, isEssential: true, notes: "" },
    { category: "clothing", name: "Casual socks", quantity: 4, isPacked: false, isEssential: false, notes: "" },
    { category: "clothing", name: "Swimsuit", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "clothing", name: "Pajamas", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "clothing", name: "Warm hat / beanie", quantity: 1, isPacked: false, isEssential: false, notes: "Bryce and Grand Canyon mornings are cold" },
    { category: "clothing", name: "Sunglasses", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "clothing", name: "Baseball cap / sun hat", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "gear", name: "Hiking boots (broken in!)", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "gear", name: "Casual sneakers / sandals", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "gear", name: "Flip flops", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "gear", name: "Hiking daypack (20-30L)", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "gear", name: "Trekking poles (optional)", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "gear", name: "Headlamp + batteries", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "gear", name: "Sunscreen SPF 50+", quantity: 2, isPacked: false, isEssential: true, notes: "" },
    { category: "gear", name: "Insect repellent", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "gear", name: "Buff / neck gaiter", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "gear", name: "Gloves (light)", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "gear", name: "Water bottles (32oz)", quantity: 2, isPacked: false, isEssential: true, notes: "" },
    { category: "gear", name: "Hydration pack / bladder", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "food", name: "PB&J supplies", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "food", name: "Chips / trail mix / nuts", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "food", name: "Granola bars / Clif bars", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "food", name: "Liquid IV electrolyte packets", quantity: 1, isPacked: false, isEssential: true, notes: "Desert hiking requires serious hydration" },
    { category: "food", name: "Chomps meat sticks", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "food", name: "Protein bars", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "food", name: "Dried fruit", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "food", name: "Ziplock bags (various sizes)", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "toiletries", name: "Toothbrush + toothpaste", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "toiletries", name: "Deodorant", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "toiletries", name: "Shampoo / conditioner", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "toiletries", name: "Body wash", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "toiletries", name: "Chapstick", quantity: 2, isPacked: false, isEssential: true, notes: "Desert air is very dry" },
    { category: "toiletries", name: "Hand lotion", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "toiletries", name: "Razors", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "toiletries", name: "Feminine hygiene items", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "toiletries", name: "Contact lenses + solution", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "toiletries", name: "Glasses", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "toiletries", name: "Nail clippers", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "other", name: "Ibuprofen / Tylenol", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "other", name: "Blister treatment / moleskin", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "other", name: "Band-aids assorted", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "other", name: "Allergy medication", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "other", name: "Antacid", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "other", name: "Personal prescriptions", quantity: 1, isPacked: false, isEssential: true, notes: "" },
    { category: "other", name: "Aloe vera gel", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "other", name: "Antiseptic wipes", quantity: 1, isPacked: false, isEssential: false, notes: "" },
    { category: "other", name: "Hand sanitizer", quantity: 2, isPacked: false, isEssential: true, notes: "" },
    { category: "other", name: "KT tape (for knees/ankles)", quantity: 1, isPacked: false, isEssential: false, notes: "" },
  ];

  const insertedPacking = await db.insert(schema.packingItems).values(packingData).returning();
  console.log(`✅ Inserted ${insertedPacking.length} packing items`);

  const remindersData: schema.NewReminder[] = [
    { title: "Book Antelope Canyon Tour ASAP", body: "antelopecanyon.com — sells out weeks in advance", dueDate: "2026-03-26", isDone: false, priority: "high" },
    { title: "Download offline maps for Arizona, Utah, Nevada", body: "Download Google Maps or Maps.me offline areas", dueDate: "2026-04-05", isDone: false, priority: "high" },
    { title: "Charge all drone batteries night before each flight day", body: "Drone has 3 batteries — charge all the night before", isDone: false, priority: "medium" },
    { title: "Red Rock Pass for Sedona hiking ($5/day)", body: "Or use America the Beautiful Pass instead", isDone: false, priority: "medium" },
    { title: "Zion: $35/vehicle entry or America the Beautiful Pass", body: "America the Beautiful Pass covers Zion", isDone: false, priority: "medium" },
    { title: "Grand Canyon: America the Beautiful Pass works here", body: "No separate entry fee needed with the pass", isDone: false, priority: "medium" },
    { title: "Bryce Canyon: $35/vehicle entry or America the Beautiful Pass", body: "America the Beautiful Pass covers Bryce Canyon", isDone: false, priority: "medium" },
    { title: "Horseshoe Bend: $10/car parking", body: "Pay at parking area — cash or card", isDone: false, priority: "low" },
    { title: "Hoover Dam: $10/vehicle parking", body: "Free to walk across dam", isDone: false, priority: "low" },
    { title: "Check Bonneville Salt Flats flooding status before Apr 16", body: "Check BLM site — April flooding can create mirror effect but may limit access", dueDate: "2026-04-14", isDone: false, priority: "medium" },
    { title: "Get Enterprise rental car return confirmation", body: "Confirm return policy and early morning drop-off availability", dueDate: "2026-04-05", isDone: false, priority: "high" },
    { title: "Starbucks city mugs: Scottsdale, Salt Lake City", body: "Don't forget to hunt for both city mugs!", isDone: false, priority: "low" },
    { title: "Return rental car night before OR at PHX airport morning of Apr 18", body: "Check Enterprise policy for early AM drop-off at PHX", dueDate: "2026-04-17", isDone: false, priority: "high" },
    { title: "Leave Tom's by 4:15 AM on Apr 18 — flight is at 6:10 AM", body: "DL0947 departs 6:10 AM from PHX. Need at least 90 min for car return + TSA.", dueDate: "2026-04-18", isDone: false, priority: "high" },
    { title: "Check weather for all stops 3 days before trip", body: "Check forecast for Sedona, Grand Canyon, Zion, Bryce, SLC, Vegas", dueDate: "2026-04-05", isDone: false, priority: "medium" },
  ];

  const insertedReminders = await db.insert(schema.reminders).values(remindersData).returning();
  console.log(`✅ Inserted ${insertedReminders.length} reminders`);

  const locationsData: schema.NewLocation[] = [
    { dayId: dayMap.get(1)!, name: "Tom's Apartment (Scottsdale)", lat: "33.4942", lng: "-111.9261", type: "hotel", description: "Home base in Scottsdale", googleMapsUrl: "https://maps.google.com/?q=33.4942,-111.9261" },
    { dayId: dayMap.get(1)!, name: "DTW Detroit Airport", lat: "42.2162", lng: "-83.3554", type: "flight", description: "Departure airport", googleMapsUrl: "https://maps.google.com/?q=42.2162,-83.3554" },
    { dayId: dayMap.get(2)!, name: "Old Town Scottsdale", lat: "33.4949", lng: "-111.9217", type: "attraction", description: "Arts district with galleries, shops, and restaurants", googleMapsUrl: "https://maps.google.com/?q=33.4949,-111.9217" },
    { dayId: dayMap.get(2)!, name: "McDowell Sonoran Preserve", lat: "33.6722", lng: "-111.8669", type: "hike", description: "Hiking trails in the Sonoran Desert", googleMapsUrl: "https://maps.google.com/?q=33.6722,-111.8669" },
    { dayId: dayMap.get(3)!, name: "Sedonuts", lat: "34.8697", lng: "-111.7560", type: "food", description: "Famous Sedona donut shop — get there early!", tip: "Cash only, sells out fast", googleMapsUrl: "https://maps.google.com/?q=34.8697,-111.7560" },
    { dayId: dayMap.get(3)!, name: "Sugar Loaf Loop Trailhead", lat: "34.8680", lng: "-111.7740", type: "hike", description: "Easy 1.9 mi loop with great views", tip: "Park at Tracup Trail trailhead lot", googleMapsUrl: "https://maps.google.com/?q=34.8680,-111.7740" },
    { dayId: dayMap.get(3)!, name: "Devil's Bridge Trailhead", lat: "34.9069", lng: "-111.8282", type: "hike", description: "Popular hike to natural rock arch", googleMapsUrl: "https://maps.google.com/?q=34.9069,-111.8282" },
    { dayId: dayMap.get(3)!, name: "Tlaquepaque Arts Village", lat: "34.8611", lng: "-111.7502", type: "attraction", description: "Spanish-style arts and crafts village", googleMapsUrl: "https://maps.google.com/?q=34.8611,-111.7502" },
    { dayId: dayMap.get(3)!, name: "Airport Mesa Trailhead", lat: "34.8555", lng: "-111.7782", type: "hike", description: "Sunset hike with panoramic red rock views", googleMapsUrl: "https://maps.google.com/?q=34.8555,-111.7782" },
    { dayId: dayMap.get(4)!, name: "Cathedral Rock Trailhead", lat: "34.8222", lng: "-111.7901", type: "hike", description: "Iconic Sedona red rock formation hike", googleMapsUrl: "https://maps.google.com/?q=34.8222,-111.7901" },
    { dayId: dayMap.get(4)!, name: "Grand Canyon Mather Point", lat: "36.0605", lng: "-112.1074", type: "attraction", description: "Main South Rim viewpoint", tip: "America the Beautiful Pass works here", googleMapsUrl: "https://maps.google.com/?q=36.0605,-112.1074" },
    { dayId: dayMap.get(4)!, name: "Antelope Canyon", lat: "36.8619", lng: "-111.3743", type: "attraction", description: "Famous slot canyon with light beams", tip: "Book tours in advance at antelopecanyon.com", googleMapsUrl: "https://maps.google.com/?q=36.8619,-111.3743" },
    { dayId: dayMap.get(4)!, name: "Horseshoe Bend", lat: "36.8791", lng: "-111.5100", type: "viewpoint", description: "Iconic Colorado River horseshoe bend overlook", tip: "$10/car parking", googleMapsUrl: "https://maps.google.com/?q=36.8791,-111.5100" },
    { dayId: dayMap.get(5)!, name: "Zion National Park Visitor Center", lat: "37.1992", lng: "-112.9871", type: "attraction", description: "Park entrance and visitor center", googleMapsUrl: "https://maps.google.com/?q=37.1992,-112.9871" },
    { dayId: dayMap.get(5)!, name: "Scout Lookout Trailhead (The Grotto)", lat: "37.2562", lng: "-112.9525", type: "hike", description: "Trailhead for Scout Lookout hike", tip: "No permit needed for Scout Lookout", googleMapsUrl: "https://maps.google.com/?q=37.2562,-112.9525" },
    { dayId: dayMap.get(5)!, name: "Canyon Overlook Trailhead", lat: "37.2149", lng: "-112.9457", type: "hike", description: "Easy 1 mi hike with great canyon views", googleMapsUrl: "https://maps.google.com/?q=37.2149,-112.9457" },
    { dayId: dayMap.get(6)!, name: "Bryce Canyon Visitor Center", lat: "37.6328", lng: "-112.1671", type: "attraction", description: "Park entrance and visitor center", googleMapsUrl: "https://maps.google.com/?q=37.6328,-112.1671" },
    { dayId: dayMap.get(6)!, name: "Sunrise Point", lat: "37.6407", lng: "-112.1588", type: "viewpoint", description: "Classic hoodoo viewpoint", tip: "Start Queen's Garden trail here", googleMapsUrl: "https://maps.google.com/?q=37.6407,-112.1588" },
    { dayId: dayMap.get(6)!, name: "Sunset Point", lat: "37.6277", lng: "-112.1672", type: "viewpoint", description: "End point for Navajo Loop trail", googleMapsUrl: "https://maps.google.com/?q=37.6277,-112.1672" },
    { dayId: dayMap.get(6)!, name: "Fairyland Point", lat: "37.6602", lng: "-112.1534", type: "viewpoint", description: "Less crowded viewpoint with great hoodoo views", googleMapsUrl: "https://maps.google.com/?q=37.6602,-112.1534" },
    { dayId: dayMap.get(7)!, name: "Bridal Veil Falls, UT", lat: "40.3272", lng: "-111.6043", type: "attraction", description: "Beautiful waterfall near Provo", googleMapsUrl: "https://maps.google.com/?q=40.3272,-111.6043" },
    { dayId: dayMap.get(8)!, name: "The Great Saltair", lat: "40.7220", lng: "-112.0992", type: "attraction", description: "Historic pavilion on Great Salt Lake shores", googleMapsUrl: "https://maps.google.com/?q=40.7220,-112.0992" },
    { dayId: dayMap.get(8)!, name: "Ensign Peak", lat: "40.7757", lng: "-111.8875", type: "hike", description: "Short 1 mi hike with panoramic SLC views", tip: "Free, stunning city panorama", googleMapsUrl: "https://maps.google.com/?q=40.7757,-111.8875" },
    { dayId: dayMap.get(9)!, name: "Bonneville Salt Flats", lat: "40.7752", lng: "-113.8141", type: "attraction", description: "Vast white salt flats", tip: "April may have flooding — creates mirror effect! Take I-80 West, Exit 4", googleMapsUrl: "https://maps.google.com/?q=40.7752,-113.8141" },
    { dayId: dayMap.get(9)!, name: "Bellagio Hotel & Fountains", lat: "36.1129", lng: "-115.1765", type: "attraction", description: "World famous dancing fountains", tip: "Shows every 15-30 min, free to watch", googleMapsUrl: "https://maps.google.com/?q=36.1129,-115.1765" },
    { dayId: dayMap.get(10)!, name: "Hoover Dam", lat: "36.0161", lng: "-114.7377", type: "attraction", description: "Historic engineering marvel on Colorado River", tip: "$10/vehicle parking, free to walk across", googleMapsUrl: "https://maps.google.com/?q=36.0161,-114.7377" },
    { dayId: dayMap.get(11)!, name: "PHX Sky Harbor Airport", lat: "33.4373", lng: "-112.0078", type: "flight", description: "Departure airport for flight home", googleMapsUrl: "https://maps.google.com/?q=33.4373,-112.0078" },
  ];

  const insertedLocations = await db.insert(schema.locations).values(locationsData).returning();
  console.log(`✅ Inserted ${insertedLocations.length} locations`);

  console.log("\n🌵 Seed complete! Southwest Road Trip database is ready.");
}

seed().catch(console.error);
