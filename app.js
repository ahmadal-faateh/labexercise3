const searchBtn = document.querySelector("button");
const input = document.querySelector("input");
const weatherCard = document.querySelector(".weather-card");
const forecastCards = document.querySelectorAll(".forecast-card");
const recentContainer = document.createElement("div");
let currentUnit = "C"; 
let weatherDataCache = null; 

const tempToggle = document.querySelector("#tempToggle");
const unitText = document.querySelector("#unitText");
recentContainer.className = "recent-searches";
document.querySelector(".top-bar").after(recentContainer);

const weatherCodes = {
0:  ["Clear Sky", "☀️"],
1:  ["Mainly Clear", "🌤️"],
2:  ["Partly Cloudy", "⛅"],
3:  ["Overcast", "☁️"],
45: ["Foggy", "🌫️"],
48: ["Depositing Rime Fog", "🌫️"],
51: ["Light Drizzle", "🌦️"],
53: ["Moderate Drizzle", "🌦️"],
55: ["Heavy Drizzle", "🌧️"],
61: ["Slight Rain", "🌧️"],
63: ["Moderate Rain", "🌧️"],
65: ["Heavy Rain", "🌧️"],
71: ["Slight Snowfall", "🌨️"],
73: ["Moderate Snowfall", "❄️"],
75: ["Heavy Snowfall", "❄️"],
77: ["Snow Grains", "🌨️"],
80: ["Slight Rain Showers", "🌦️"],
81: ["Moderate Rain Showers", "🌦️"],
82: ["Heavy Rain Showers", "⛈️"],
85: ["Slight Snow Showers", "🌨️"],
86: ["Heavy Snow Showers", "🌨️"],
95: ["Thunderstorm", "⛈️"],
96: ["Thunderstorm with Hail", "⛈️"],
99: ["Thunderstorm, Heavy Hail", "⛈️"]
};

searchBtn.addEventListener("click", () => {
    let city = input.value.trim();

    if (city.length < 2) {
        alert("Enter at least 2 letters.");
        return;
    }

    fetchWeather(city);
});

let debounceTimer;

input.addEventListener("keyup", () => {
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
        let city = input.value.trim();

        if (city.length >= 2) {
            fetchWeather(city);
        }
    }, 500);
});

async function fetchWeather(city) {

    try {

        showSkeleton();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        let geoURL = `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`;

        let geoRes = await fetch(geoURL, {
            signal: controller.signal
        });

        if (!geoRes.ok) {
            throw new Error("HTTP Error: " + geoRes.status);
        }

        let geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
        weatherCard.innerHTML = `<h2>City not found</h2>`;
        document.querySelector(".forecast-section").style.display = "none";
        return;
        }
        document.querySelector(".forecast-section").style.display = "block";

        let place = geoData.results[0];
        let lat = place.latitude;
        let lon = place.longitude;
        let timezone = place.timezone;

        let weatherURL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;

        let weatherRes = await fetch(weatherURL, {
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!weatherRes.ok) {
            throw new Error("HTTP Error: " + weatherRes.status);
        }

        let weatherData = await weatherRes.json();

        displayWeather(place.name, weatherData);
        getLocalTime(timezone);
        saveRecentSearch(place.name);
    }
    catch(error) {
        weatherCard.innerHTML = `
            <h2>Error</h2>
            <p>${error.message}</p>
            <button onclick="fetchWeather('${city}')">Retry</button>
        `;
    }
}

function saveRecentSearch(city) {
    let searches = JSON.parse(localStorage.getItem("recentWeather")) || [];
    
    searches = searches.filter(s => s.toLowerCase() !== city.toLowerCase());
    searches.unshift(city);
    
    if (searches.length > 5) searches.pop();
    
    localStorage.setItem("recentWeather", JSON.stringify(searches));
    displayRecentSearches();
}

function displayRecentSearches() {
    const searches = JSON.parse(localStorage.getItem("recentWeather")) || [];
    recentContainer.innerHTML = ""; 

    if (searches.length > 0) {
        const label = document.createElement("span");
        label.className = "recent-label";
        label.textContent = "Recent:";
        recentContainer.appendChild(label);
    }

    searches.forEach(city => {
        const chip = document.createElement("span");
        chip.className = "search-chip";
        chip.textContent = city;
        
        chip.addEventListener("click", () => {
            input.value = city;
            fetchWeather(city);
        });
        
        recentContainer.appendChild(chip);
    });
}

if (tempToggle) {
    tempToggle.addEventListener("change", () => {
        currentUnit = tempToggle.checked ? "F" : "C";
        if (unitText) unitText.textContent = currentUnit === "F" ? "Fahrenheit" : "Celsius";
        
        if (weatherDataCache) {
            displayWeather(weatherDataCache.cityName, weatherDataCache.data);
        }
    });
}

function formatTemp(celsius) {
    if (currentUnit === "F") {
        return ((celsius * 9) / 5 + 32).toFixed(1);
    }
    return celsius;
}

function displayWeather(city, data) {

    weatherDataCache = { cityName: city, data: data };

    let temp = formatTemp(data.current_weather.temperature);
    let wind = data.current_weather.windspeed;
    let code = data.current_weather.weathercode;
    let humidity = data.hourly.relativehumidity_2m[0];
    let info = weatherCodes[code] || ["Unknown", "❓"];

    weatherCard.innerHTML = `
        <h2>${city}</h2>
        <h1>${temp}°${currentUnit}</h1>
        <p>${info[1]} ${info[0]}</p>
        <p>Humidity: ${humidity}%</p>
        <p>Wind Speed: ${wind} km/h</p>
        <p id="timeBox">Loading time...</p>
    `;

    for (let i = 0; i < 7; i++) {
        let max = formatTemp(data.daily.temperature_2m_max[i]);
        let min = formatTemp(data.daily.temperature_2m_min[i]);
        let code = data.daily.weathercode[i];
        let info = weatherCodes[code] || ["Unknown", "❓"];
        let day = new Date(data.daily.time[i]).toLocaleDateString("en-US", { weekday: "short" });

        forecastCards[i].innerHTML = `
            <h4>${day}</h4>
            <h1>${info[1]}</h1>
            <p>${max}° / ${min}°</p>
        `;
    }
}


function getLocalTime(zone) {
    $.getJSON(`https://worldtimeapi.org/api/timezone/${zone}`)
    .done(function(data) {

        let time = new Date(data.datetime).toLocaleTimeString();

        $("#timeBox").text("Local Time: " + time);
    })

    .fail(function() {

        let time = new Date().toLocaleTimeString();

        $("#timeBox").text("Browser Time: " + time);
    })

    .always(function() {

        console.log("Time request finished:", new Date().toLocaleString());
    });
}



function showSkeleton() {
    weatherCard.innerHTML = `
        <div class="line skeleton title"></div>
        <div class="line skeleton temp"></div>
        <div class="line skeleton medium"></div>
        <div class="line skeleton small"></div>
        <div class="line skeleton small"></div>
        <div class="line skeleton small"></div>
    `;
    forecastCards.forEach(card => {
        card.innerHTML = `
            <div class="line skeleton small"></div>
            <div class="emoji skeleton"></div>
            <div class="line skeleton small"></div>
        `;
    });
}