import { NextResponse } from "next/server";
import axios from "axios";
import OpenLocationCodePkg from "open-location-code";

const OLCClass = OpenLocationCodePkg?.OpenLocationCode || OpenLocationCodePkg;
const olc = typeof OLCClass === "function" ? new OLCClass() : null;

async function expandGoogleMapsUrl(url) {
  try {
    const res = await axios.get(url, {
      maxRedirects: 10,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      timeout: 6000,
    });

    const finalUrl = res.request?.res?.responseUrl || res.config?.url || "";
    const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data || "");
    const combined = finalUrl + " " + body;

    // 1. Prioritaskan KOORDINAT PIN PRESISI TITIK POI (!3d<LAT>!4d<LNG>)
    const match3d4d = combined.match(/!3d([-+]?\d{1,2}\.\d+)!4d([-+]?\d{1,3}\.\d+)/);
    if (match3d4d) {
      return { lat: match3d4d[1], lng: match3d4d[2] };
    }

    // 2. Format alternatif PIN POI (!2d<LNG>!3d<LAT>)
    const match2d3d = combined.match(/!2d([-+]?\d{1,3}\.\d+)!3d([-+]?\d{1,2}\.\d+)/);
    if (match2d3d) {
      return { lat: match2d3d[2], lng: match2d3d[1] };
    }

    // 3. Format query q=lat,lng
    const matchQ = combined.match(/q=([-+]?\d{1,2}\.\d+)[,\s]+([-+]?\d{1,3}\.\d+)/);
    if (matchQ) {
      return { lat: matchQ[1], lng: matchQ[2] };
    }

    // 4. Format search URL /maps/search/lat,lng
    const matchSearch = combined.match(/\/maps\/search\/([-+]?\d{1,2}\.\d+),(?:%2B|\+)?([-+]?\d{1,3}\.\d+)/i);
    if (matchSearch) {
      return { lat: matchSearch[1], lng: matchSearch[2] };
    }

    // 5. Fallback ke koordinat pusat viewport kamera map (@lat,lng)
    const matchAt = combined.match(/@([-+]?\d{1,2}\.\d+),([-+]?\d{1,3}\.\d+)/);
    if (matchAt) {
      return { lat: matchAt[1], lng: matchAt[2] };
    }
  } catch (e) {
    console.warn("expandGoogleMapsUrl error:", e.message);
  }
  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();

  if (!query) {
    return NextResponse.json({ results: [], extracted: null });
  }

  // 1. Cek Google Maps URL (Short Link maps.app.goo.gl, goo.gl/maps, google.com/maps, atau http/https)
  if (
    query.includes("maps.app.goo.gl") ||
    query.includes("goo.gl") ||
    query.includes("google.com/maps") ||
    query.includes("maps.google") ||
    query.startsWith("http://") ||
    query.startsWith("https://")
  ) {
    const coords = await expandGoogleMapsUrl(query);
    if (coords) {
      return NextResponse.json({
        extracted: {
          lat: coords.lat,
          lng: coords.lng,
          label: "Titik Google Maps",
          type: "gmaps",
        },
        results: [],
      });
    }
  }

  // 2. Cek Mentah Koordinat Lat, Lng (contoh: -7.039844, 107.567438)
  const coordRegex = /^([-+]?\d{1,2}\.\d+)[,\s]+([-+]?\d{1,3}\.\d+)$/;
  const coordMatch = query.match(coordRegex);
  if (coordMatch) {
    return NextResponse.json({
      extracted: {
        lat: coordMatch[1],
        lng: coordMatch[2],
        label: "Titik Koordinat",
        type: "coords",
      },
      results: [],
    });
  }

  // 3. Cek Plus Code (misal: "WM7G+WR9" atau "WMRF+J8V, Patrolsari...")
  const plusCodeMatch = query.match(
    /\b([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3})\b/i,
  );
  if (plusCodeMatch && olc) {
    const rawPlusCode = plusCodeMatch[1].toUpperCase();
    try {
      let fullCode = rawPlusCode;
      if (olc.isShort(rawPlusCode)) {
        let refLat = -7.039;
        let refLng = 107.567;

        const cleanAddress = query
          .replace(plusCodeMatch[0], "")
          .replace(/^[,\s]+|[,\s]+$/g, "");

        if (cleanAddress) {
          try {
            const refRes = await axios.get(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanAddress)}&format=json&limit=1&countrycodes=id`,
              {
                headers: {
                  "User-Agent": "NOCR-Dashboard/1.0 (admin@npma.my.id)",
                },
                timeout: 3000,
              },
            );
            if (refRes.data && refRes.data.length > 0) {
              refLat = parseFloat(refRes.data[0].lat);
              refLng = parseFloat(refRes.data[0].lon);
            }
          } catch (e) {
            // fallback acuan
          }
        }
        fullCode = olc.recoverNearest(rawPlusCode, refLat, refLng);
      }

      if (olc.isValid(fullCode) && !olc.isShort(fullCode)) {
        const decoded = olc.decode(fullCode);
        const latStr = decoded.latitudeCenter.toFixed(6);
        const lngStr = decoded.longitudeCenter.toFixed(6);
        const cleanAddress = query
          .replace(plusCodeMatch[0], "")
          .replace(/^[,\s]+|[,\s]+$/g, "");

        return NextResponse.json({
          extracted: {
            lat: latStr,
            lng: lngStr,
            label: cleanAddress || `Plus Code ${rawPlusCode}`,
            type: "pluscode",
            plusCode: rawPlusCode,
          },
          results: [],
        });
      }
    } catch (e) {
      console.warn("Server Plus Code decode error:", e);
    }
  }

  return NextResponse.json({ extracted: null, results: [] });
}
