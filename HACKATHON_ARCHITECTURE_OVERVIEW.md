# Voyager Architecture Overview (Mermaid + Script)

Use this section before implementation demo.
Language is simple and judge-friendly.

## Mermaid Architecture
```mermaid
flowchart TD
    UI[User in Voyager Web App] --> INPUT[Query and Smart Filters]
    INPUT --> SEARCH[API Search Orchestrator]

    SEARCH --> PARSER[AI Query Parser]
    PARSER --> INTENT[Structured Trip Intent]

    INTENT --> HOTEL_SVC[Hotel Service]
    INTENT --> FLIGHT_SVC[Flight Service]
    INTENT --> LOCAL_SVC[Activities and Dining Service]

    HOTEL_SVC --> TBO_HOTEL[TBO Hotel API]
    TBO_HOTEL -. empty or error .-> HOTEL_FB[Hotel Fallback Logic]
    HOTEL_FB --> HOTEL_CATALOG[TBO Static Hotel Catalog]
    HOTEL_FB --> HOTEL_BACKUP[Backup Hotel Inventory]
    TBO_HOTEL --> HOTEL_DATA[Hotel Results]
    HOTEL_CATALOG --> HOTEL_DATA
    HOTEL_BACKUP --> HOTEL_DATA

    FLIGHT_SVC --> TBO_AIR[TBO Air API]
    TBO_AIR -. empty or error .-> FLIGHT_FB[Flight Fallback Logic]
    FLIGHT_FB --> FLIGHT_BACKUP[Backup Flight Inventory]
    TBO_AIR --> FLIGHT_DATA[Flight Results]
    FLIGHT_BACKUP --> FLIGHT_DATA

    LOCAL_SVC --> PLACES[Google Places API]
    PLACES -. unavailable .-> LOCAL_FB[Local Fallback Logic]
    LOCAL_FB --> LOCAL_BACKUP[Backup Activities and Dining]
    PLACES --> LOCAL_DATA[Activities and Dining Results]
    LOCAL_BACKUP --> LOCAL_DATA

    HOTEL_DATA --> SCORE[Scoring Ranking and Filter Engine]
    FLIGHT_DATA --> SCORE
    LOCAL_DATA --> SCORE

    SCORE --> RECO[Recommendation Engine]
    SCORE --> DASH[Unified Dashboard]
    RECO --> DASH

    DASH --> CHAT[API LLM Chat]
    DASH --> ITIN[API LLM Itinerary]
    DASH --> INSIGHTS[API Trip Insights]

    CHAT --> AI[Gemini AI Model]
    ITIN --> AI
    INSIGHTS --> WEATHER[Open Meteo Weather API]
    WEATHER --> INSIGHTS
    INSIGHTS --> DASH
```

## Architecture Script (About 75 to 90 Seconds)
"Before I show implementation, let me explain Voyager architecture quickly.

First, user gives one travel query and smart filters in the web app.
This request goes to our search orchestrator.

Then AI query parser converts natural language into structured trip intent, like source, destination, days, budget, and preferences.

Using this intent, Voyager calls hotels, flights, and local experiences in parallel.
Hotels come from TBO Hotel API.
Flights come from TBO Air API.
Activities and dining come from Google Places.

After data comes in, our scoring and filter engine ranks the best options.
Then recommendation engine creates top trip combinations and sends output to one unified dashboard.

For intelligence, we have three extra services:
LLM chat for interactive help, itinerary API for day-wise plan, and trip insights API for weather and practical guidance.

Most important, we have fallback logic.
If any live API is slow, empty, or unavailable, Voyager switches to fallback inventory sources, so user journey does not break.

Now I will move to implementation and show this flow live in product."

## Short Transition Line
"Architecture is clear, now let us see how this works in real user flow."
