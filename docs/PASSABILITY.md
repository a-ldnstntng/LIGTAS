# LIGTAS METRO: Road Passability & Vehicle Depth Logic

This document defines the physical benchmarks, hydraulic principles, depth thresholds, and behavioral assumptions governing vehicle passability assessments in LIGTAS METRO.

---

## 1. Overview and Operational Scope

Standard traffic navigation platforms (e.g., Google Maps, Waze) evaluate congestion purely through GPS velocity slowdowns. During tropical monsoons (Habagat) and typhoons in Metro Manila, velocity drops do not distinguish between ordinary traffic queueing and catastrophic vehicle entrapment in standing floodwaters.

LIGTAS METRO evaluates road passability as a function of **localized inundation depth** (\(d\)) against the physical geometry and mechanical intake thresholds of specific vehicle classifications.

---

## 2. Vehicle Classifications & Physical Clearances

Civilian traffic in Metro Manila is grouped into three operational mobility profiles:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VEHICLE PROFILES & LIMITS                       │
├──────────────────────┬──────────────────┬──────────────┬───────────────┤
│ Vehicle Profile      │ Ground Clearance │ Exhaust Pipe │ Air Intake    │
├──────────────────────┼──────────────────┼──────────────┼───────────────┤
│ Sedan / Hatchback    │ 130 – 160 mm     │ 180 – 220 mm │ 250 – 350 mm  │
│ SUV / Pickup / 4x4   │ 200 – 240 mm     │ 350 – 450 mm │ 550 – 750 mm  │
│ Motorcycle / Scooter │ 120 – 160 mm     │ 150 – 250 mm │ 250 – 350 mm  │
│ Pedestrian           │ N/A (Ankle=10cm) │ N/A (Knee)   │ N/A (Hip=90cm)│
└──────────────────────┴──────────────────┴──────────────┴───────────────┘
```

### A. Sedans & Low-Clearance Vehicles (Profile 1)
- **Representative Models**: Toyota Vios, Honda City, Mitsubishi Mirage, Hyundai Accent.
- **Physical Vulnerabilities**:
  - Air cleaner intake horn located directly behind front grille or inside wheel-well liner at ~30 cm height.
  - Alternator, radiator fan motors, and starter motor positioned low on engine block.
  - Door bottom seals sit ~18–22 cm above road plane; interior carpeting flooding occurs at ~25 cm.

### B. SUVs, Pickups & High-Clearance 4x4s (Profile 2)
- **Representative Models**: Toyota Fortuner, Mitsubishi Montero Sport, Isuzu D-Max, Ford Everest, Nissan Navara.
- **Physical Vulnerabilities**:
  - Un-snorkeled air intake located inside top fender well (~65–75 cm).
  - Differential breather valves on rear axle casings (~40–45 cm); water ingress contaminates gear oil.
  - Transfer case and transmission electronic control actuators (~45–55 cm).

### C. Motorcycles & Scooters (Profile 3)
- **Representative Models**: Yamaha NMAX, Honda Click, Honda ADV, Underbone 110–150cc commuters.
- **Physical Vulnerabilities**:
  - Continuously Variable Transmission (CVT) air inlet on automatic scooters is positioned low (~20 cm); water ingress causes drive belt slippage and immediate loss of propulsion.
  - Spark plug boot seal failure under splashing.

### D. Pedestrians (Profile 4)
- **Physical Vulnerabilities**:
  - Hydrodynamic drag of fast-moving current (>15 cm water moving at >1.5 m/s sweeps adults off their feet).
  - Submerged dislodged manhole covers, missing storm drain gratings, and invisible curb drops.
  - Leptospirosis infection risk from contaminated urban stormwater.

---

## 3. Threshold Matrix & Status Rules

LIGTAS evaluates corridor water depth against the following deterministic thresholds:

| Inundation Depth (\(d\)) | Sedan Assessment | SUV / 4x4 Assessment | Motorcycle / Pedestrian | MMDA / NDRRMC Benchmark |
| :--- | :--- | :--- | :--- | :--- |
| **\(d < 0.05\text{ m}\)** (<2 in) | **PASSABLE** (Clear) | **PASSABLE** (Clear) | **PASSABLE** (Clear) | Normal Surface Drainage |
| **\(0.05\text{ m} \le d < 0.10\text{ m}\)** (2–4 in) | **PASSABLE** (Clear) | **PASSABLE** (Clear) | **PASSABLE** (Gutter Flow) | Gutter Deep |
| **\(0.10\text{ m} \le d < 0.20\text{ m}\)** (4–8 in) | **PASSABLE** (Ponding) | **PASSABLE** (Safe) | **CAUTION / HAZARD** | Half-Tire (Sedan) |
| **\(0.20\text{ m} \le d < 0.35\text{ m}\)** (8–14 in) | **CAUTION** (Critical) | **PASSABLE** (Safe) | **IMPASSABLE** (Do Not Enter) | Tire Deep (Sedan) / Half-Knee |
| **\(0.35\text{ m} \le d < 0.50\text{ m}\)** (14–20 in) | **IMPASSABLE** (Submerged) | **CAUTION** (Axle Level) | **IMPASSABLE** (Swept Risk) | Knee Deep / Waist Deep |
| **\(d \ge 0.50\text{ m}\)** (>20 in) | **IMPASSABLE** (Floated) | **IMPASSABLE** (Submerged) | **IMPASSABLE** (Life Safety Risk) | Chest Deep / Submerged |

---

## 4. Key Physical Assumptions & Safety Mitigations

### 1. The Bow Wave Effect (Dynamic Head Surge)
- **Physics**: When a vehicle drives through 20 cm of standing water, or when an oncoming truck or bus passes, a displacement wave (bow wave) creates a localized surge of \(+10\text{ cm to }+25\text{ cm}\).
- **Rule Mitigation**: Sedan caution threshold is set conservatively at **0.20m**, well below typical intake height (30cm), to account for bow wave surges from passing vehicles.

### 2. Flotation Friction Loss
- **Physics**: At 30 cm depth, passenger cars lose approximately 30% of effective tire contact friction due to buoyancy from hollow body cavities. At 45–60 cm depth, buoyancy exceeds curb weight, causing tires to lose contact with pavement and float downstream.
- **Rule Mitigation**: Hard-lock sedans to **Impassable** at \(>0.35\text{ m}\).

### 3. Missing Infrastructure Shields
- **Context**: During torrential floods along España Blvd, Rizal Ave, and Araneta Ave, hydrostatic pressure dislodges cast-iron catch basin lids and drainage grates.
- **Rule Mitigation**: Motorcycle and pedestrian advisory switches to **Hazard** as soon as water depth exceeds gutter level (\(>0.10\text{ m}\)) because submerged manholes cannot be seen by naked eye or street cameras.

---

## 5. Software Implementation Reference

In the LIGTAS codebase, the passability decision logic is implemented in:
- `src/services/weatherService.js`: `computeLiveInundation()` derives estimated depth from radar accumulation and corridor basin vulnerability factors.
- `src/App.jsx`: Evaluates `activeMetrics.depthMeters` against the three profile boundaries (`0.20m` for Sedans, `0.45m` for SUVs, `0.10m` for Motorcycles/Pedestrians) and pairs the assessment with the recommended elevated bypass viaduct.
