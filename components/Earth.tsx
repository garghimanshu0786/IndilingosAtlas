"use client";

import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import type { Feature } from "geojson";
import { useEffect, useRef } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { cityIsLive, type City } from "@/lib/atlas";

const LIVE_ISO = new Set(
  [356, 392],
);

function pt(el: Element, event: PointerEvent) {
  const box = el.getBoundingClientRect();
  return [event.clientX - box.left, event.clientY - box.top] as const;
}

export function Earth({
  cities,
  focus,
  locked,
  onPick,
}: {
  cities: City[];
  focus: City | null;
  locked?: boolean;
  onPick: (place: City) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const sphereRef = useRef<SVGCircleElement>(null);
  const gratRef = useRef<SVGPathElement>(null);
  const landRef = useRef<SVGGElement>(null);
  const pinsRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef(focus);
  const lockedRef = useRef(Boolean(locked));
  const reducedRef = useRef(false);
  const dragRef = useRef<{ last: readonly [number, number] } | null>(null);
  const rotRef = useRef<[number, number]>([-(focus?.lng ?? 77.209), -(focus?.lat ?? 20)]);
  const countriesRef = useRef<Feature[]>([]);
  const projRef = useRef(geoOrthographic().clipAngle(90));
  const pathRef = useRef(geoPath(projRef.current));
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    focusRef.current = focus;
    lockedRef.current = Boolean(locked);
    if (focus && locked) {
      rotRef.current = [-focus.lng, -focus.lat];
    }
  }, [focus, locked]);

  useEffect(() => {
    const wrapEl = wrapRef.current;
    const svgEl = svgRef.current;
    const sphereEl = sphereRef.current;
    const gratEl = gratRef.current;
    const landEl = landRef.current;
    const pinsEl = pinsRef.current;
    if (!wrapEl || !svgEl || !sphereEl || !gratEl || !landEl || !pinsEl) return;
    const wrap = wrapEl;
    const svg = svgEl;
    const sphere = sphereEl;
    const grat = gratEl;
    const land = landEl;
    const pins = pinsEl;

    const proj = projRef.current;
    const path = pathRef.current;
    const graticule = geoGraticule10();
    let running = true;
    let frame = 0;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = media.matches;
    const onMotion = () => {
      reducedRef.current = media.matches;
    };
    media.addEventListener("change", onMotion);

    function layout() {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      sizeRef.current = { w, h };
      const rad = (Math.min(w, h) * 0.82) / 2;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("width", String(w));
      svg.setAttribute("height", String(h));
      proj.scale(rad).translate([w / 2, h / 2]);
      sphere.setAttribute("cx", String(w / 2));
      sphere.setAttribute("cy", String(h / 2));
      sphere.setAttribute("r", String(rad));
      draw();
    }

    function draw() {
      proj.rotate(rotRef.current);
      path.projection(proj);
      grat.setAttribute("d", path(graticule) ?? "");
      const nodes = land.querySelectorAll("path");
      countriesRef.current.forEach((country, i) => {
        const node = nodes[i];
        if (node) node.setAttribute("d", path(country) ?? "");
      });
      const center: [number, number] = [-rotRef.current[0], -rotRef.current[1]];
      for (const place of cities) {
        const pin = pins.querySelector<HTMLButtonElement>(`[data-pin="${place.id}"]`);
        if (!pin) continue;
        const xy = proj([place.lng, place.lat]);
        const dist = geoDistance([place.lng, place.lat], center);
        if (!xy || dist >= Math.PI / 2 - 0.02) {
          pin.style.display = "none";
          continue;
        }
        pin.style.display = "flex";
        pin.style.left = `${xy[0]}px`;
        pin.style.top = `${xy[1]}px`;
        pin.style.opacity = String(Math.max(0.2, 1 - dist / (Math.PI / 2)));
      }
    }

    function paintLand(features: Feature[]) {
      countriesRef.current = features;
      land.replaceChildren();
      for (const country of features) {
        const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const id = Number(country.id);
        el.setAttribute("fill", LIVE_ISO.has(id) ? "#f4d06a" : "#efe6d0");
        el.setAttribute("stroke", "#141414");
        el.setAttribute("stroke-width", "0.7");
        el.setAttribute("stroke-linejoin", "round");
        land.appendChild(el);
      }
      draw();
    }

    const onDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("[data-pin]")) return;
      svg.setPointerCapture(event.pointerId);
      dragRef.current = { last: pt(svg, event) };
    };
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = pt(svg, event);
      rotRef.current = [
        rotRef.current[0] + (next[0] - drag.last[0]) * 0.4,
        Math.max(-85, Math.min(85, rotRef.current[1] - (next[1] - drag.last[1]) * 0.4)),
      ];
      drag.last = next;
      draw();
    };
    const onUp = () => {
      dragRef.current = null;
    };

    function tick() {
      if (!running) return;
      if (!dragRef.current && !lockedRef.current && !reducedRef.current) {
        rotRef.current = [rotRef.current[0] + 0.12, rotRef.current[1]];
        draw();
      } else if (lockedRef.current && !dragRef.current) {
        const target = focusRef.current;
        if (target) {
          rotRef.current = [-target.lng, -target.lat];
          draw();
        }
      } else {
        draw();
      }
      frame = window.requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(layout);
    ro.observe(wrap);
    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
    wrap.addEventListener("pointerup", onUp);

    layout();
    frame = window.requestAnimationFrame(tick);

    void fetch("/atlas/countries-110m.json", { cache: "force-cache" })
      .then((res) => {
        if (!res.ok) throw new Error("atlas missing");
        return res.json() as Promise<Topology<{ countries: GeometryCollection }>>;
      })
      .then((topo) => {
        const collection = feature(topo, topo.objects.countries);
        paintLand("features" in collection ? collection.features : []);
      })
      .catch(() => {
        paintLand([]);
      });

    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      ro.disconnect();
      media.removeEventListener("change", onMotion);
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onUp);
      wrap.removeEventListener("pointerup", onUp);
    };
  }, [cities]);

  return (
    <div ref={wrapRef} className="atlas-earth">
      <svg ref={svgRef} className="atlas-svg" aria-hidden="true">
        <circle ref={sphereRef} className="atlas-sphere" />
        <path ref={gratRef} className="atlas-grat" />
        <g ref={landRef} />
      </svg>
      <div ref={pinsRef} className="atlas-pins">
        {cities.map((place) => {
          const live = cityIsLive(place.id);
          const active = place.id === focus?.id;
          return (
            <button
              key={place.id}
              type="button"
              data-pin={place.id}
              aria-label={`${place.country}, ${place.language}${live ? ", live" : ", coming soon"}`}
              aria-pressed={active}
              onClick={() => onPick(place)}
              className={`pin ${live ? "playable" : "soon"} ${active ? "active" : ""}`}
            >
              <span className="flag">{place.country}</span>
              <span className="dot" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
