"""Bounding-box helpers. Coordinates are WGS84 degrees."""

import math
from dataclasses import dataclass

EARTH_RADIUS_KM = 6371.0088

# Czech Republic bounding box (slightly padded). Version 1.0 serves CZ only.
CZ_BBOX = (12.09, 48.55, 18.86, 51.06)  # west, south, east, north


@dataclass(frozen=True)
class BBox:
    west: float
    south: float
    east: float
    north: float

    def is_valid(self) -> bool:
        return -180 <= self.west < self.east <= 180 and -90 <= self.south < self.north <= 90

    def within(self, outer: tuple[float, float, float, float]) -> bool:
        w, s, e, n = outer
        return self.west >= w and self.south >= s and self.east <= e and self.north <= n

    def area_km2(self) -> float:
        """Area of a lon/lat rectangle on a sphere."""
        lat1, lat2 = math.radians(self.south), math.radians(self.north)
        dlon = math.radians(self.east - self.west)
        return EARTH_RADIUS_KM**2 * dlon * abs(math.sin(lat2) - math.sin(lat1))

    def key(self) -> str:
        """Stable cache key (rounded to ~10 m)."""
        return "_".join(f"{v:.4f}" for v in (self.west, self.south, self.east, self.north))
