// js/displayComLogo.js

import { db, collection, query, orderBy, onSnapshot } from "../firebase/firebase.js";

// --- GLOBAL TRACKING STATE ---
let activeSelectedCompanyId = null;
let allCompaniesData = []; // cache of latest snapshot, used to build the modal grid

// ---------------------------------------------------
// STEP 1: Auto-tag booth cells (Normalized to UPPERCASE)
// ---------------------------------------------------
function tagBoothCells() {
    const boothPattern = /^[A-Za-z]{0,3}\d+$/;

    const scope = document.querySelectorAll(
        ".parentRow1 div, .subParent1 div, .row1 div, .row2 div, .number-row2 div, .number-row3 div"
    );

    let count = 0;

    scope.forEach(el => {
        if (el.children.length > 0) return;
        if (el.classList.contains("booth-cell")) return;

        const text = el.textContent.trim();
        if (!boothPattern.test(text)) return;

        el.classList.add("booth-cell");
        el.dataset.booth = text.toUpperCase();
        count++;
    });

    console.log(`✅ Auto-tagged ${count} booth cells`);
}

// ---------------------------------------------------
// Card builder for the modal grid
// ---------------------------------------------------
function createCompanyCard(data, compId) {
    const card = document.createElement("div");
    card.className = "company-card";
    card.dataset.companyId = compId;

    if (activeSelectedCompanyId !== null && compId === activeSelectedCompanyId) {
        card.classList.add("active-selected-card");
    }

    const dotHtml = data.statusColor
        ? `<span class="company-status-dot" style="--dot-color:${data.statusColor}"></span>`
        : "";

    card.innerHTML = `
        ${dotHtml}
        <div class="companyLogo">
            <img src="${data.asset || ''}" alt="${data.companyName || 'Brand'} Logo" />
        </div>
        <div class="company-name">${data.companyName || 'Unnamed'}</div>
    `;

    card.addEventListener("click", () => {
        if (activeSelectedCompanyId === compId) {
            activeSelectedCompanyId = null;
            resetAllHighlights();
        } else {
            activeSelectedCompanyId = compId;
            highlightBooths(data);
        }

        syncActiveCardStyling();
        closeCompanyModal(); // jump to the map after picking a company
    });

    return card;
}

// Keeps the "active-selected-card" class correct across the modal grid
function syncActiveCardStyling() {
    document.querySelectorAll(".company-card").forEach(c => {
        if (activeSelectedCompanyId !== null && c.dataset.companyId === String(activeSelectedCompanyId)) {
            c.classList.add("active-selected-card");
        } else {
            c.classList.remove("active-selected-card");
        }
    });
}

// ---------------------------------------------------
// STEP 2: Listen to booth/company data in REAL-TIME from Firestore
// (No sidebar list — just keeps the cache + modal fresh)
// ---------------------------------------------------
function listenToBooths() {
    console.log("Listening to booths in real-time from Firestore...");

    const boothsCollection = collection(db, "companyBoots");
    const q = query(boothsCollection, orderBy("companyId", "asc"));

    onSnapshot(q, (snapshot) => {
        allCompaniesData = [];

        if (snapshot.empty) {
            activeSelectedCompanyId = null;
            resetAllHighlights();
            renderModalGrid();
            return;
        }

        let currentlyActiveCompanyData = null;

        snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const compId = data.companyId;

            allCompaniesData.push(data);

            if (activeSelectedCompanyId !== null && compId === activeSelectedCompanyId) {
                currentlyActiveCompanyData = data;
            }
        });

        renderModalGrid();

        if (activeSelectedCompanyId !== null) {
            if (currentlyActiveCompanyData) {
                highlightBooths(currentlyActiveCompanyData);
            } else {
                activeSelectedCompanyId = null;
                resetAllHighlights();
            }
        }

        console.log("⚡ Real-time data sync completed!");
    }, (error) => {
        console.error("❌ Error syncing real-time board data:", error);
    });
}

// Helper function to wipe styles cleanly
function resetAllHighlights() {
    const allCells = document.querySelectorAll(".booth-cell");
    allCells.forEach(cell => {
        cell.style.backgroundColor = "";
        cell.style.color = "";
        cell.classList.remove("highlighted");

        const existingPin = cell.querySelector(".booth-pin");
        if (existingPin) {
            existingPin.remove();
        }
    });
}

// ---------------------------------------------------
// STEP 3: Case-Insensitive Matching for Highlighting
// ---------------------------------------------------
function highlightBooths(data) {
    resetAllHighlights();

    if (!data || !Array.isArray(data.bootNumber) || data.bootNumber.length === 0) {
        console.warn("⚠️ No booth numbers found for this company.");
        return;
    }

    const allBoothCells = document.querySelectorAll(".booth-cell");

    data.bootNumber.forEach(num => {
        const cleanNum = String(num).trim().toUpperCase();
        let found = false;

        allBoothCells.forEach(cell => {
            const cellBooth = (cell.dataset.booth || "").trim().toUpperCase();

            if (cellBooth === cleanNum) {
                found = true;
                cell.style.backgroundColor = data.statusColor || "#007bff";
                cell.classList.add("highlighted");

                if (!cell.querySelector(".booth-pin")) {
                    const pin = document.createElement("i");
                    pin.className = "fa-solid fa-location-dot booth-pin";
                    pin.style.fontFamily = '"Font Awesome 6 Free", "Font Awesome 7 Free", sans-serif';
                    pin.style.fontWeight = "900";
                    pin.style.color = "red";
                    pin.style.fontSize = "2rem";

                    cell.style.position = "relative";
                    cell.appendChild(pin);
                }
            }
        });

        if (!found) {
            console.warn(`⚠️ Target map cell not found for booth number: "${cleanNum}"`);
        }
    });
}

// ---------------------------------------------------
// STEP 4: Popup / Modal logic
// ---------------------------------------------------
function renderModalGrid() {
    const overlay = document.getElementById("companyModalOverlay");
    const modalGrid = document.getElementById("companyModalGrid");
    if (!overlay || !modalGrid) return;

    modalGrid.innerHTML = "";

    if (allCompaniesData.length === 0) {
        modalGrid.innerHTML = "<p>No booths found.</p>";
        return;
    }

    allCompaniesData.forEach(data => {
        const card = createCompanyCard(data, data.companyId);
        modalGrid.appendChild(card);
    });
}

function openCompanyModal() {
    const overlay = document.getElementById("companyModalOverlay");
    if (!overlay) return;
    overlay.classList.add("open");
    renderModalGrid();
}

function closeCompanyModal() {
    const overlay = document.getElementById("companyModalOverlay");
    if (!overlay) return;
    overlay.classList.remove("open");
}

function setupModalControls() {
    const openBtn = document.getElementById("openCompanyListBtn");
    const closeBtn = document.getElementById("closeCompanyModalBtn");
    const overlay = document.getElementById("companyModalOverlay");

    if (openBtn) openBtn.addEventListener("click", openCompanyModal);
    if (closeBtn) closeBtn.addEventListener("click", closeCompanyModal);

    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeCompanyModal();
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeCompanyModal();
    });
}

// ---------------------------------------------------
// STEP 5: Run everything on page load
// ---------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    tagBoothCells();
    listenToBooths();
    setupModalControls();
});