// Editorial intro for each region page (/greatlakes, /florida, …). Rendered on
// the server (functions/seo.js) and in the app (src/Landing.jsx). Plain text
// only — no HTML. Reviewed by marine-data-scientist.
export const REGION_INTROS = {
  greatlakes: {
    heading: "Boating the Great Lakes: what to know",
    paragraphs: [
      "These launches span all five lakes: Toledo, Cleveland and Erie on Lake Erie; Rochester and Oswego on Ontario; Port Huron and Alpena on Huron; Chicago, Muskegon and Traverse City on Michigan; Duluth, Marquette and Bayfield on Superior. On every lake, wind direction decides which shore takes the waves, because fetch, the open water the wind crosses, does most of the work. An offshore wind can leave the ramp calm while chop builds a mile out.",
      "Erie is shallow, so its waves are short and steep, and northeast is the wind to respect on the Ohio and Pennsylvania shore. A north or south wind runs the length of Michigan toward Chicago, and a northeaster runs the length of Superior at Duluth. On Ontario, a west wind has the whole lake to build waves toward Oswego. Huron’s Michigan shore is most exposed to northeast and east. Harbor mouths between piers, as at Holland or Rochester, are often the roughest water of the trip.",
      "Huron, Michigan, Ontario and especially Superior stay cold well into summer. Thunderstorms cross the lakes quickly, and gales arrive from October into December. Many open-lake buoys are pulled for winter, so a launch may be rated from the NWS forecast instead of a live reading; the page says which.",
      "Check wind direction against your launch’s onshore side, wave period as well as height, and any wind shift. This is a planning aid: read the NWS nearshore forecast and use your own judgment.",
    ],
  },

  florida: {
    heading: "Boating Florida: inlets, the Keys and the Gulf side",
    paragraphs: [
      "Florida is three kinds of water. On the Atlantic you run out through Mayport, St. Augustine, Ponce Inlet, Port Canaveral, Sebastian, Jupiter, Palm Beach, Fort Lauderdale and Miami. The Keys run from Key Largo through Islamorada and Marathon to Key West. The Gulf side runs from Marco Island and Naples through Tampa Bay and Clearwater to Panama City Beach, Destin and Pensacola.",
      "On the Atlantic the inlet is the hazard. An outgoing tide against swell or an onshore wind stands waves up across the mouth even when the sea outside looks moderate. Ponce, Sebastian and Jupiter are narrow and shoaling; Port Canaveral and Government Cut are deep ship channels that still get rough on a strong ebb. Off southeast Florida the Gulf Stream runs close in, and any wind with north in it stacks up steep seas. In the Keys, Hawk Channel chops up in a steady wind and winter fronts bring a day or more of north wind.",
      "Summer mornings are the calm part of the day. Afternoon thunderstorms build most days, and waterspouts are common around South Florida and the Keys. Hurricane season runs June 1 to November 30, and distant-storm swell can make an inlet dangerous under blue sky.",
      "Ocean launches are rated on sea height and period together. Tropical watches read CAUTION and warnings read NO-GO. Check the tide, read the NWS coastal waters forecast, and use your own judgment.",
    ],
  },

  "gulf-coast": {
    heading: "Boating the Gulf Coast: fronts, passes and shallow bays",
    paragraphs: [
      "From Orange Beach and Fairhope on Mobile Bay through Biloxi and Grand Isle to Galveston, Kemah, Port Aransas and South Padre Island, the Gulf looks gentle, and on most summer mornings it is. The bottom slopes out for miles, so seas are mostly local wind waves with short periods, often three to six seconds. Three feet at four seconds rides far rougher than three feet at ten, so period counts in the verdict.",
      "Winter means cold fronts every few days. Southerly wind builds onshore seas ahead of a front, a line of showers can bring a sudden shift as it passes, and strong north wind follows. North is offshore here: the beach looks flat while seas build a few miles out. It can also push water out of the bays and leave channels shallower than charted. Late winter and spring bring sea fog, especially off Louisiana and Texas.",
      "The passes, like Perdido Pass, Bolivar Roads, Aransas Pass and Brazos Santiago, run hard with each tide, and an outgoing tide against an onshore sea is the dangerous mix. Mobile Bay, Galveston Bay and the Laguna Madre are shallow enough to build a steep, square chop quickly. Summer brings early-afternoon thunderstorms, and hurricane season runs June 1 to November 30.",
      "Watch front timing, wave period and wind direction. This is a planning aid; confirm with the NWS Gulf forecast and use your own judgment.",
    ],
  },

  southeast: {
    heading: "Boating Georgia and the Carolinas: tides, inlets and the Outer Banks",
    paragraphs: [
      "This coast runs from St. Simons Island and Brunswick through Savannah and Tybee, Hilton Head, Charleston and Murrells Inlet to Wrightsville Beach, Morehead City and Oregon Inlet. It is marsh, tidal creeks, barrier islands and inlets, and the water under the boat is often the bigger story than the wind. Around Savannah and Brunswick the tide typically rises and falls seven to nine feet twice a day, less farther north.",
      "That much water means strong currents, creeks that turn to mud at low tide, and short steep chop wherever wind runs against current. Reaching the ocean means crossing an inlet, many framed by jetties that can be partly submerged at high tide. An outgoing tide against an incoming sea makes the worst water, so plan around slack or the flood. At Oregon Inlet the shoals shift, so last season’s track may now be shallow. Off Cape Hatteras the Gulf Stream swings close, and north wind stacks its seas up steeply.",
      "Fall through spring brings nor’easters. In summer, sea-breeze thunderstorms build inland in the afternoon and push back over inlets and sounds. Hurricane season runs June 1 to November 30, and the Outer Banks are among the most frequently hit stretches of the East Coast.",
      "Check the tide as carefully as the wind. Our verdicts cannot see the tide at your inlet, so read NOAA tide predictions and the NWS coastal forecast, and use your own judgment.",
    ],
  },

  socal: {
    heading: "Boating Southern California: marine layer, afternoon wind and swell",
    paragraphs: [
      "Southern California boats year-round, from San Diego and Mission Bay through Oceanside, Dana Point, Newport Beach, Long Beach and Marina del Rey to Channel Islands Harbor and Santa Barbara. Mornings are light and often foggy under a marine layer. As the land warms, a westerly sea breeze builds through the afternoon and can reach 15 to 20 knots in exposed areas. Run long trips early and expect a wetter ride home.",
      "In fall and winter the Santa Ana, a hot, dry, gusty northeast wind, is offshore: the water near the harbor looks flat while the wind pushes small boats out and builds a steep chop farther away. Santa Anas can gust well above the forecast average. Winter brings the biggest long-period swell from the west and northwest, summer swell comes from the south, and long swell that rides easily offshore can break across harbor entrances and jetties.",
      "Crossings to Catalina, about 20 miles out, or to the Channel Islands are open-ocean trips. Check the channel forecast rather than the harbor, and go before the westerlies build. Winter water is commonly in the upper 50s to low 60s Fahrenheit.",
      "Watch swell period as well as height, and the afternoon trend on the hourly timeline. This is a planning aid; confirm with the NWS coastal waters forecast and use your own judgment.",
    ],
  },

  islands: {
    heading: "Boating Hawaii and Puerto Rico: trade winds and open-ocean swell",
    paragraphs: [
      "We cover Kewalo Basin in Honolulu, Honokohau Harbor at Kona and Ma’alaea on Maui, plus San Juan and Fajardo in Puerto Rico. There is little shelf to slow the swell, so deep water starts close to shore and long-period waves arrive with much of their energy intact. A wave that looks modest offshore can break hard on a reef or at a harbor mouth, so period matters as much as height.",
      "Both live under trade winds from the northeast or east, usually lighter early and stronger by afternoon. The windward side takes the full sea; the leeward side, like the Kona coast, can be far calmer. Wind accelerates through channels such as the Alenuihaha, and Ma’alaea Bay is often calm in the morning and very windy by afternoon. Winter Kona winds can expose normally sheltered leeward harbors.",
      "Swell has seasons: north swell on Hawaii’s north and west shores in winter, and North Atlantic swell on Puerto Rico’s north coast, including San Juan, from late fall to early spring. Fajardo is the jumping-off point for Culebra and Vieques, open crossings exposed to the trades. Hurricane season runs June 1 to November 30.",
      "Watch harbor entrances for breaking sets and read the channel forecast, not the view from the dock. This is a planning aid; confirm with the NWS and use your own judgment.",
    ],
  },

  pnw: {
    heading: "Boating Puget Sound and the San Juans: current first, wind second",
    paragraphs: [
      "This page covers Shilshole Bay, Everett, Tacoma and Olympia on Puget Sound, Port Townsend, Anacortes and Friday Harbor in the San Juans and Admiralty Inlet, and Westport on the coast. The inland waters are mostly protected, so wind and waves are often modest. The hazards the weather map misses matter more: strong tidal currents, tide rips, ferry and ship traffic, floating logs, and water that stays cold all year.",
      "Tide range is large and water squeezing through narrow passes can run at several knots. Deception Pass, the Tacoma Narrows, Admiralty Inlet and many San Juan channels are known for current and eddies at peak flood or ebb. Wind against current is the mix to respect. Time passes for slack water or a fair current using NOAA predictions, because a wind forecast does not show current.",
      "The Strait of Juan de Fuca, Rosario Strait and Haro Strait are more open. A summer westerly often builds through the afternoon in the Strait, worse against an ebb. Westport faces the Pacific and is a different day altogether. Puget Sound water commonly stays in the 40s to mid-50s Fahrenheit, so dress for the water.",
      "A calm verdict inside the Sound says nothing about current at a pass. Treat it as a planning aid, check the NWS forecast for your zone, and use your own judgment.",
    ],
  },

  oregon: {
    heading: "Boating the Oregon coast: crossing the bar",
    paragraphs: [
      "On the Oregon coast nearly every harbor sits behind a river bar: Astoria and Hammond at the Columbia River Bar, Garibaldi, Depoe Bay, Newport on Yaquina Bay, Coos Bay and Charleston, and Brookings on the Chetco. The bar, not the offshore forecast, is often the deciding factor. A day that looks fine at sea can still have breaking waves across the entrance.",
      "Swell steepens and can break as it crosses the shoal, and the danger is greatest when an outgoing tide pushes against incoming swell. Longer periods carry more energy over a bar at the same height. The Columbia River Bar, the Graveyard of the Pacific, is among the most dangerous crossings in the world, and Depoe Bay has a very narrow entrance through rock. The Coast Guard can restrict a bar to recreational boats, and those restrictions are enforceable.",
      "In summer, northwest wind builds through the afternoon and mornings are best. Fall and winter storms bring large swell and sometimes days with no usable crossing. Fog is common and upwelling keeps water in the 50s Fahrenheit even in July.",
      "At our bar harbors, any marine advisory or warning turns the verdict NO-GO, because bars break before the open sea looks bad. Even a GO describes the marine zone, not the bar. Check bar status with the Coast Guard and use your own judgment.",
    ],
  },

  norcal: {
    heading: "Boating San Francisco Bay and Northern California",
    paragraphs: [
      "Northern California is two boating worlds. Inside San Francisco Bay, Sausalito, Berkeley, Alameda and Redwood City sit behind one of the most reliable summer sea breezes anywhere. Outside, Half Moon Bay, Santa Cruz, Monterey, Bodega Bay and Humboldt Bay face a steep, foggy, cold coast exposed to northwest wind and swell, with few protected harbors.",
      "On summer days, heat in the Central Valley pulls cool air through the Golden Gate. Mornings are light, then a west to southwest breeze builds and in the central Bay commonly reaches 20 knots or more. The Bay is shallow in many places, so chop is short and steep, especially against an ebb. Be back by early afternoon. A strong ebb against ocean swell and westerly wind can steepen seas sharply at the Gate, so plan that passage for slack or a flood.",
      "North of Point Reyes, northwest wind accelerates around headlands, and harbors are far apart, so plan fuel and fallback options. The Humboldt Bay entrance is a well-known bar where swell breaks across the channel. Fog is regular, and ocean water is commonly in the 50s Fahrenheit year-round.",
      "Our verdicts describe the nearby marine zone, not the Gate or a bar. Treat them as a planning aid, check the NWS forecast and Coast Guard bar notices, and use your own judgment.",
    ],
  },

  northeast: {
    heading: "Boating the Northeast: Sound, harbor, Cape and Gulf of Maine",
    paragraphs: [
      "We cover Portland, Maine, Boston Harbor, Hyannis, Buzzards Bay, Newport, Norwalk and New Haven on Long Island Sound, New York Harbor, Barnegat Inlet and Cape May. The common threads are strong currents in narrow passages, summer thunderstorms and fog, and water that stays cold well into summer.",
      "Long Island Sound is about 100 miles long and fairly protected from swell, but a strong westerly or easterly down its axis builds a short, steep chop, and a squall line can cross it fast on a hot afternoon. At the eastern end, The Race and Plum Gut run several knots, and wind against current builds rips. In Buzzards Bay a thermal southwesterly typically builds through summer afternoons, reaching 15 to 25 knots. New York Harbor means heavy ferry, tug and ship traffic, and New Jersey inlets steepen when an ebb meets onshore swell.",
      "Fog is common, thick in the Gulf of Maine, and lobster pots can foul a propeller. Tide range grows northward, to roughly ten feet or more in much of Maine. Water often stays in the 50s Fahrenheit into early summer. Hurricane season peaks late summer into fall, and nor’easters make inlets unusable in fall and winter.",
      "Wind and wave numbers do not show current, fog or traffic. Treat the verdict as a planning aid, check NOAA current predictions and the NWS forecast, and use your own judgment.",
    ],
  },

  alaska: {
    heading: "Boating Alaska: tides, williwaws and cold water",
    paragraphs: [
      "We cover Ketchikan, Juneau’s Auke Bay and Sitka in Southeast Alaska, and Seward, Homer, Whittier and Valdez in Southcentral. Tides are very large, on the order of 30 feet in Cook Inlet near Anchorage, and currents can shape the whole day. A beach you land on at high tide may be hundreds of feet from the water at low. Wind against tide in narrow passages builds steep seas.",
      "Mountains and fjords make their own weather. Williwaws are sudden violent gusts spilling down slopes, so a calm-looking day can bring gusts far above the forecast in places like Prince William Sound and Lynn Canal. Wind funnels through channels around Whittier and Valdez. The open Gulf of Alaska can produce large seas and long swell, with frequent gales in fall and winter, while much of the Inside Passage is milder. Stay well back from tidewater glacier faces.",
      "Water commonly sits in the 40s to low 50s Fahrenheit even in summer, so a fall overboard becomes an emergency within minutes. Cell and VHF coverage can be thin and help far away, so carry a VHF, consider a satellite messenger or beacon, extra fuel, and file a float plan.",
      "A verdict reflects the nearest forecast zone, and remote conditions can differ sharply. Use it as a planning aid, check the NWS forecast and NOAA tides, and use your own judgment, conservatively.",
    ],
  },

  chesapeake: {
    heading: "Boating the Chesapeake Bay: shallow water and short, steep chop",
    paragraphs: [
      "The Chesapeake is the largest estuary in the United States, a long narrow bay fed by dozens of rivers. Our launch is Middle River and Essex, east of Baltimore, which gives access to the upper bay. The bay averages only about 20 feet deep, so waves stay short and steep: the famous Chesapeake chop. A two- to three-foot sea can hit a small boat much harder than the same height on the open ocean.",
      "Direction matters as much as speed. The bay runs roughly north to south for about 200 miles but is only a few miles across in many places, so a north or south wind has a long run to build waves while east or west has much less. Wind against the tidal current steepens the chop. In the tidal rivers, a strong sustained wind can push water out and leave it lower than the tide tables predict.",
      "Hot summer afternoons bring thunderstorms that build over land to the west and cross the bay toward evening, with sudden shifts, gusts and lightning. Be at the dock early and watch the western sky. Ships and tugs with barges cannot turn to avoid you, and crab pot floats can foul a propeller. Spring water is still cold enough for cold shock.",
      "Look at wave period as well as height. This is a planning aid; check the NWS marine forecast and radar, and use your own judgment.",
    ],
  },

  carolina: {
    heading: "Boating the Carolina sounds: Pamlico’s wind-driven chop",
    paragraphs: [
      "Behind the Outer Banks lie Pamlico and Albemarle Sounds, enormous and shallow. Pamlico Sound is roughly 80 miles long, yet much of it is less than 20 feet deep. Our sound-side launch is Bath, on the Pamlico River. Like other shallow water, the sound builds a short, steep chop quickly in a moderate wind, and the long fetch across open water can make a crossing rough before the forecast sounds alarming.",
      "A steady wind can also push water from one side of the sound to the other, raising the level on the downwind shore and draining the upwind side, so normally covered shoals can show up. Wind against current stands the chop up further. Before a crossing, consider which way the wind has blown and for how long, check depths on a current chart, and leave time to get back before it builds.",
      "Fall through spring brings nor’easters, with days of strong northeast wind and high water. Summer mornings are calmest, and afternoon thunderstorms can push back over the sound with lightning and sudden gusts. Hurricane season runs June 1 to November 30, and this coast is one of the most frequently hit on the East Coast.",
      "Watch wind direction and duration, and the hourly timeline for afternoon storms. Our verdict is a planning aid from the nearest marine forecast zone, so check the NWS forecast for the sound and use your own judgment.",
    ],
  },
};
