# LIGTAS METRO

Metro Manila Flood-Safe Commute & Bypass Radar. Real-time flood monitoring, passability analysis, MapLibre GL spatial hazard overlays, and ground-truth 360° corridor street views powered by Mapillary.

## Features

- **Dynamic Hazard & Telemetry Matrix**: Real-time road inundation depth metrics, rainfall rate, and vehicle passability assessments (Sedans, SUVs/4x4s, Pedestrians).
- **MapLibre GL Interactive Radar**: Vector basemap with live flood hazard polygons across Metro Manila corridors (España, Sta. Mesa, Araneta, Taft, Katipunan, and dynamic search for any Philippine location).
- **Dual-Mode Street Viewer Modal**:
  - **Ground-Truth 360° (Mapillary)**: Interactive 360-degree street-level imagery with compass bearing and spatial node navigation.
  - **Corridor Sensor Telemetry**: Ultrasonic river gauges (Marikina Sto. Niño, Pasig River, Manggahan Floodway) and rainfall trend sparklines.
- **Dynamic Geocoding Search**: Real-time OpenStreetMap Nominatim integration restricted to the Philippines (PAR bounds).

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS
- **Mapping & GIS**: MapLibre GL, Mapillary JS
- **Icons**: Lucide React

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/a-ldnstntng/LIGTAS.git
   cd LIGTAS
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env` and supply your Mapillary client token:
   ```env
   VITE_MAPILLARY_CLIENT_TOKEN=your_token_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

