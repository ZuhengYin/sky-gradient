
// DOM Elements
const timeDisplay = document.getElementById('time-display');
const statusDisplay = document.getElementById('status-display');
const locInput = document.getElementById('location-input');
const searchBtn = document.getElementById('search-btn');
const locateBtn = document.getElementById('locate-btn');
const musicBtn = document.getElementById('music-btn');
const suggestionsList = document.getElementById('suggestions');

// Constants
let userLat = 0;
let userLon = 0;
let userTimeZone = null; // Store timezone string like 'Europe/Berlin'
let locationFound = false;
let searchTimeout = null; // For debouncing
// Music
let audio = new Audio('http://radio.stereoscenic.com/asp-s');
audio.preload = 'none'; // Prevent blocking load
let isPlaying = false;

// Time & State
let currentSolarState = { solarHour: 12, sunriseHour: 6, sunsetHour: 18 };

// Color Palette (Pastel)
let PALETTE = {};

function setup() {
    // Create full screen canvas
    let cnv = createCanvas(windowWidth, windowHeight);
    cnv.parent('sky');
    // Mobile Optimization (Broadened for tablets/landscape)
    if (windowWidth < 1024) {
        pixelDensity(1); // Crucial for performance on high-DPI phones
        frameRate(30);   // Cap framerate
    }

    // UI Event Listeners


    // UI Event Listeners
    searchBtn.addEventListener('click', () => {
        searchLocation(locInput.value);
    });

    locInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchLocation(locInput.value);
            suggestionsList.classList.remove('active');
        }
    });

    // Autocomplete Listener
    locInput.addEventListener('input', (e) => {
        const query = e.target.value;
        clearTimeout(searchTimeout);
        if (query.length < 3) {
            suggestionsList.classList.remove('active');
            return;
        }

        searchTimeout = setTimeout(() => {
            fetchSuggestions(query);
        }, 300); // 300ms debounce
    });

    // Close suggestions on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            suggestionsList.classList.remove('active');
        }
    });

    locateBtn.addEventListener('click', () => {
        if (navigator.geolocation) {
            statusDisplay.textContent = "Locating you...";
            navigator.geolocation.getCurrentPosition((pos) => {
                userLat = pos.coords.latitude;
                userLon = pos.coords.longitude;
                userTimeZone = null; // Revert to system timezone
                locationFound = true;
                statusDisplay.textContent = `Current Location (Lat: ${userLat.toFixed(2)}, Lon: ${userLon.toFixed(2)})`;
                locInput.value = ""; // Clear input
            }, (err) => {
                statusDisplay.textContent = "Could not access location.";
            });
        } else {
            statusDisplay.textContent = "Geolocation not supported.";
        }
    });

    // Music Toggle
    musicBtn.addEventListener('click', () => {
        if (!isPlaying) {
            audio.play().then(() => {
                isPlaying = true;
                musicBtn.classList.add('active');
            }).catch(e => {
                console.error("Audio Play Error:", e);
                statusDisplay.textContent = "Audio stream unavailable.";
            });
        } else {
            audio.pause();
            isPlaying = false;
            musicBtn.classList.remove('active');
        }
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            // Only use GPS if user hasn't searched yet (simplification: we overwrite it)
            if (!locationFound) {
                userLat = pos.coords.latitude;
                userLon = pos.coords.longitude;
                // For local GPS, we use system default timezone behavior (null)
                locationFound = true;
                statusDisplay.textContent = `Lat: ${userLat.toFixed(2)}, Lon: ${userLon.toFixed(2)}`;
            }
        }, (err) => {
            if (!locationFound) statusDisplay.textContent = "Location access denied. Using system time.";
        });
    } else {
        if (!locationFound) statusDisplay.textContent = "Geolocation not supported.";
    }
}

async function fetchSuggestions(query) {
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
        const response = await fetch(url);
        const data = await response.json();

        suggestionsList.innerHTML = '';
        if (data.results && data.results.length > 0) {
            data.results.forEach(city => {
                const li = document.createElement('li');
                li.textContent = `${city.name}, ${city.country} (${city.admin1 || ''})`;
                li.addEventListener('click', () => {
                    locInput.value = city.name;
                    setLocationData(city.name, city.country, city.latitude, city.longitude, city.timezone);
                    suggestionsList.classList.remove('active');
                });
                suggestionsList.appendChild(li);
            });
            suggestionsList.classList.add('active');
        } else {
            suggestionsList.classList.remove('active');
        }
    } catch (e) {
        console.error("Suggestion error:", e);
    }
}

async function searchLocation(query) {
    if (!query) return;
    statusDisplay.textContent = "Searching...";

    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            setLocationData(result.name, result.country, result.latitude, result.longitude, result.timezone);
        } else {
            statusDisplay.textContent = "Location not found.";
        }
    } catch (e) {
        console.error(e);
        statusDisplay.textContent = "Search error.";
    }
}

function setLocationData(name, country, lat, lon, tz) {
    userLat = lat;
    userLon = lon;
    userTimeZone = tz;
    locationFound = true;
    statusDisplay.textContent = `${name}, ${country}`;
}

function draw() {
    background(0);

    let now = new Date();

    // Format Time: Use found timezone or system default
    let timeOptions = { hour: '2-digit', minute: '2-digit' };
    if (userTimeZone) {
        timeOptions.timeZone = userTimeZone;
    }
    let timeStr = now.toLocaleTimeString([], timeOptions);
    timeDisplay.innerHTML = timeStr.replace(/:/g, '<span class="colon">:</span>');

    if (locationFound) {
        // We need 'now' relative to the location's timezone to calculate solar positions correctly?
        // Actually, getSolarState primarily needs UTC time + Longitude.
        // Javascript Date object IS consistent in UTC.
        // So passing 'now' (which has correct UTC timestamp) is correct for physics.
        currentSolarState = getSolarState(now, userLat, userLon);
    } else {
        let h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
        currentSolarState = { solarHour: h, sunriseHour: 6, sunsetHour: 18 };
    }

    let colors = getGenerativeColors(currentSolarState);
    updateTheme(colors); // Adaptive UI
    // drawGenerativeGradient(colors); // Disabled for performance
    background(colors.mid); // Simple static background to preserve color vibe

    // 4. Draw Interactive Trails
    drawInteractiveTrails(colors);
}

function drawGenerativeGradient(colors) {
    // Reverted to 1D Vertical Gradient (Step 223 Logic)
    // But added "Drifting Stops" logic so colors shift slowly on screen.

    let t = millis() * 0.0005;

    // Calculate dynamic stop positions using noise
    // This makes the bands expand/contract independently
    let stop1 = map(noise(t, 10), 0, 1, 0.15, 0.35); // Target 0.25
    let stop2 = map(noise(t, 20), 0, 1, 0.40, 0.60); // Target 0.50
    let stop3 = map(noise(t, 30), 0, 1, 0.65, 0.85); // Target 0.75

    // Globalizing stops for ripple effect to use matching noise
    // (Ideally we'd restructure this, but let's just recalculate it in the trail function for simplicity)

    for (let y = 0; y < height; y++) {
        // ... (existing loop content) ...
        // Normalized Y (0 to 1)
        let nY = map(y, 0, height, 0, 1);
        let wave = noise(y * 0.0005, t);
        let displacement = map(wave, 0, 1, -0.1, 0.1); // Subtle wave
        let pos = nY + displacement;

        let c;
        if (pos < stop1) {
            let amt = map(pos, 0, stop1, 0, 1);
            c = lerpColor(colors.top, colors.upperMid, constrain(amt, 0, 1));
        } else if (pos < stop2) {
            let amt = map(pos, stop1, stop2, 0, 1);
            c = lerpColor(colors.upperMid, colors.mid, constrain(amt, 0, 1));
        } else if (pos < stop3) {
            let amt = map(pos, stop2, stop3, 0, 1);
            c = lerpColor(colors.mid, colors.lowerMid, constrain(amt, 0, 1));
        } else {
            let amt = map(pos, stop3, 1, 0, 1);
            c = lerpColor(colors.lowerMid, colors.bottom, constrain(amt, 0, 1));
        }

        // Dithering
        let ditherAmt = 1;
        stroke(
            red(c) + random(-ditherAmt, ditherAmt),
            green(c) + random(-ditherAmt, ditherAmt),
            blue(c) + random(-ditherAmt, ditherAmt)
        );
        line(0, y, width, y);
    }
}

let cursorTrails = [];

function drawInteractiveTrails(colors) {
    // Correct mouse coordinates for CSS transform: scale(1.25)
    // p5.mouseX reports coordinates relative to the SCALED element surface (e.g. 0-1250).
    // We need to map this back to the internal canvas resolution (0-1000).
    let cx = mouseX / 1.25;
    let cy = mouseY / 1.25;

    // Only add trail if mouse is pressed (Clicking or Dragging)
    if (mouseIsPressed && mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        let isMoving = true;
        if (cursorTrails.length > 0) {
            let last = cursorTrails[cursorTrails.length - 1];
            let d = dist(cx, cy, last.x, last.y);
            if (d < 0.005) isMoving = false;
        }

        if (isMoving) {
            cursorTrails.push({ x: cx, y: cy, time: millis() });
        }
    }

    // Recalculate same noise stops for consistency
    let t = millis() * 0.0005;
    let stop1 = map(noise(t, 10), 0, 1, 0.15, 0.35);
    let stop2 = map(noise(t, 20), 0, 1, 0.40, 0.60);
    let stop3 = map(noise(t, 30), 0, 1, 0.65, 0.85);

    // Draw and update trails
    for (let i = cursorTrails.length - 1; i >= 0; i--) {
        let p = cursorTrails[i];
        let age = millis() - p.time;

        // Remove after 2.5 seconds
        if (age > 2500) {
            cursorTrails.splice(i, 1);
            continue;
        }

        // Fade out
        let opacity = map(age, 0, 2500, 255, 0);
        let size = map(age, 0, 2500, 25, 200); // Expand ripple (Start smaller)

        // Calculate "Displaced" color (Ripple Effect)
        // Optimization: On mobile, skip the expensive color lerping for ripples
        let c;
        if (windowWidth < 1024) {
            c = color(255, 255, 255); // Simple white ripple
        } else {
            // We take color from Y + Offset
            let rippleOffset = 0.15;
            let sampleY = p.y / height + rippleOffset;
            if (sampleY > 1) sampleY -= 1; // Wrap or clamping
            sampleY = constrain(sampleY, 0, 1);
            c = getColorAtProportion(sampleY, colors, stop1, stop2, stop3);
        }

        noStroke();
        c.setAlpha(opacity);
        fill(c);
        ellipse(p.x, p.y, size);
    }
}

function getColorAtProportion(pos, colors, s1, s2, s3) {
    let c;
    if (pos < s1) {
        c = lerpColor(colors.top, colors.upperMid, map(pos, 0, s1, 0, 1));
    } else if (pos < s2) {
        c = lerpColor(colors.upperMid, colors.mid, map(pos, s1, s2, 0, 1));
    } else if (pos < s3) {
        c = lerpColor(colors.mid, colors.lowerMid, map(pos, s2, s3, 0, 1));
    } else {
        c = lerpColor(colors.lowerMid, colors.bottom, map(pos, s3, 1, 0, 1));
    }
    return c;
}

// ... Unchanged Helpers ...

function getGenerativeColors(state) {
    let h = state.solarHour;
    let rise = state.sunriseHour;
    let set = state.sunsetHour;
    let noon = 12.0;

    function makeKeyframe(cTop, cMid, cBot) {
        return {
            top: cTop,
            upperMid: lerpColor(cTop, cMid, 0.5),
            mid: cMid,
            lowerMid: lerpColor(cMid, cBot, 0.5),
            bottom: cBot
        };
    }

    const kDeepNight = makeKeyframe(PALETTE.softBlack, PALETTE.darkPurple, PALETTE.deepBlue);
    const kDawn = { top: PALETTE.purple, upperMid: PALETTE.lavender, mid: PALETTE.lightPink, lowerMid: PALETTE.salmon, bottom: PALETTE.beige };
    const kMorning = makeKeyframe(PALETTE.beige, PALETTE.softWhite, PALETTE.softWhite);
    const kNoon = makeKeyframe(PALETTE.softWhite, PALETTE.veryPaleBlue, PALETTE.softWhite);
    const kAfternoon = makeKeyframe(PALETTE.lavender, PALETTE.softBlue, PALETTE.veryPaleBlue);
    const kSunset = { top: PALETTE.beige, upperMid: PALETTE.salmon, mid: PALETTE.hotPink, lowerMid: PALETTE.purple, bottom: PALETTE.deepBlue };
    const kEvening = makeKeyframe(PALETTE.mutedNavy, PALETTE.darkPurple, PALETTE.purple);
    const kMidnight = makeKeyframe(PALETTE.softBlack, PALETTE.softBlack, PALETTE.darkPurple);

    if (h < 4) return lerpKeyframe(kMidnight, kDeepNight, map(h, 0, 4, 0, 1));
    if (h < rise) return lerpKeyframe(kDeepNight, kDawn, map(h, 4, rise, 0, 1));
    if (h < rise + 3) return lerpKeyframe(kDawn, kMorning, map(h, rise, rise + 3, 0, 1));
    if (h < noon) return lerpKeyframe(kMorning, kNoon, map(h, rise + 3, noon, 0, 1));
    if (h < set - 2) return lerpKeyframe(kNoon, kAfternoon, map(h, noon, set - 2, 0, 1));
    if (h < set - 1) return lerpKeyframe(kAfternoon, kSunset, map(h, set - 2, set - 1, 0, 1));
    if (h < set + 1) return lerpKeyframe(kSunset, kEvening, map(h, set - 1, set + 1, 0, 1));
    if (h < set + 3) return lerpKeyframe(kEvening, kMidnight, map(h, set + 1, set + 3, 0, 1));
    return lerpKeyframe(kEvening, kMidnight, map(h, set + 3, 24, 0, 1));
}

function lerpKeyframe(k1, k2, amt) {
    return {
        top: lerpColor(k1.top, k2.top, amt),
        upperMid: lerpColor(k1.upperMid, k2.upperMid, amt),
        mid: lerpColor(k1.mid, k2.mid, amt),
        lowerMid: lerpColor(k1.lowerMid, k2.lowerMid, amt),
        bottom: lerpColor(k1.bottom, k2.bottom, amt)
    };
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

function getSolarState(date, lat, lon) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    const rad = Math.PI / 180;
    const dec = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * rad);
    const B = (360 / 365) * (dayOfYear - 81) * rad;
    const Eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    const totalMinutesUTC = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    let solarMinutes = totalMinutesUTC + (lon * 4) + Eot;
    while (solarMinutes < 0) solarMinutes += 1440;
    while (solarMinutes >= 1440) solarMinutes -= 1440;
    const solarHour = solarMinutes / 60;
    const latRad = lat * rad;
    const decRad = dec * rad;
    let cosH = -Math.tan(latRad) * Math.tan(decRad);
    if (cosH > 1) cosH = 1;
    if (cosH < -1) cosH = -1;
    const H_hours = (Math.acos(cosH) * 180 / Math.PI) / 15;
    return { solarHour, sunriseHour: 12 - H_hours, sunsetHour: 12 + H_hours };
}

function updateTheme(colors) {
    // Simple luminance check
    // We average the brightness of the top, mid, and bottom colors
    let r = (red(colors.top) + red(colors.mid) + red(colors.bottom)) / 3;
    let g = (green(colors.top) + green(colors.mid) + green(colors.bottom)) / 3;
    let b = (blue(colors.top) + blue(colors.mid) + blue(colors.bottom)) / 3;

    // Perceived luminance formula (approximate)
    let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    if (luma < 100) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}
