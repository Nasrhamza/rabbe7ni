import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Vibration, View } from "react-native";
import Svg, { Circle, Defs, G, Mask, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";

const AnimatedG = Animated.createAnimatedComponent(G);

export interface WheelPrize {
  readonly code: string;
  readonly label: string;
  readonly color: string;
}

/**
 * Short vibration used as win/tick feedback.
 *
 * Uses the React Native `Vibration` API rather than a haptics package so the games gain tactile
 * feedback without adding a dependency. `expo-haptics` would give richer, iOS-native impact styles
 * if it is ever added to the app.
 */
export function pulse(pattern: "tick" | "win" = "tick"): void {
  Vibration.vibrate(pattern === "win" ? [0, 40, 60, 120] : 18);
}

/** Cartesian point on the wheel edge for a clockwise angle measured from twelve o'clock. */
function pointOnCircle(cx: number, cy: number, radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function segmentPath(cx: number, cy: number, radius: number, start: number, end: number): string {
  const from = pointOnCircle(cx, cy, radius, start);
  const to = pointOnCircle(cx, cy, radius, end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${from.x} ${from.y} A ${radius} ${radius} 0 ${largeArc} 1 ${to.x} ${to.y} Z`;
}

/**
 * Prize wheel drawn from the tenant's actual prize list.
 *
 * The previous implementation rotated a static PNG of a generic wheel, so the segment that stopped
 * under the pointer had no relationship to the prize the server awarded — the result only appeared
 * as text underneath. Drawing the segments means the wheel stops on the prize that was won.
 */
export function PrizeWheel({
  prizes,
  size = 260,
  spinning,
  targetIndex,
  onSettled,
}: Readonly<{
  prizes: readonly WheelPrize[];
  size?: number;
  spinning: boolean;
  /** Index into `prizes` of the awarded prize, or undefined while idle. */
  targetIndex?: number | undefined;
  onSettled?: () => void;
}>) {
  const rotation = useRef(new Animated.Value(0)).current;
  const settled = useRef(0);
  const radius = size / 2;
  const count = Math.max(prizes.length, 1);
  const segmentAngle = 360 / count;

  useEffect(() => {
    if (!spinning || targetIndex === undefined) return;

    // Segment i occupies [i·segmentAngle, (i+1)·segmentAngle) clockwise from twelve o'clock, so its
    // centre sits at (i + 0.5)·segmentAngle. Rotating the wheel by the complement of that angle
    // brings the centre under the fixed pointer; whole turns are added purely for the spin.
    const centre = (targetIndex + 0.5) * segmentAngle;
    const landing = 360 - centre;
    const total = settled.current + 360 * 5 + ((landing - (settled.current % 360)) % 360);

    Animated.timing(rotation, {
      toValue: total,
      duration: 3400,
      easing: Easing.out(Easing.cubic),
      // The SVG group is rotated through its `rotation` prop rather than a style transform, and
      // prop animation cannot be handed to the native driver.
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      settled.current = total;
      pulse("win");
      onSettled?.();
    });
    // `onSettled` is intentionally excluded: it is a fresh closure each render and would restart
    // the animation mid-spin.
  }, [spinning, targetIndex, segmentAngle, rotation]);

  const segments = useMemo(
    () =>
      prizes.map((prize, index) => {
        const start = index * segmentAngle;
        const label = pointOnCircle(radius, radius, radius * 0.64, start + segmentAngle / 2);
        return { prize, start, end: start + segmentAngle, label };
      }),
    [prizes, segmentAngle, radius],
  );

  return (
    <View style={{ height: size + 26, width: size }}>
      <Svg height={size} style={styles.wheelSvg} width={size}>
        <AnimatedG origin={`${radius}, ${radius}`} rotation={rotation as unknown as number}>
          {segments.map(({ prize, start, end, label }) => (
            <G key={prize.code}>
              <Path d={segmentPath(radius, radius, radius - 6, start, end)} fill={prize.color} />
              <SvgText
                fill="#ffffff"
                fontSize={Math.max(9, Math.min(13, 150 / count))}
                fontWeight="700"
                origin={`${label.x}, ${label.y}`}
                rotation={start + segmentAngle / 2}
                textAnchor="middle"
                x={label.x}
                y={label.y}
              >
                {prize.label.length > 14 ? `${prize.label.slice(0, 13)}…` : prize.label}
              </SvgText>
            </G>
          ))}
          <Circle cx={radius} cy={radius} fill="#ffffff" r={radius * 0.16} />
        </AnimatedG>
        <Circle
          cx={radius}
          cy={radius}
          fill="none"
          r={radius - 3}
          stroke="#12142b"
          strokeWidth={6}
        />
      </Svg>
      {/* Fixed pointer at twelve o'clock; the wheel rotates beneath it. */}
      <Svg height={26} style={styles.pointer} width={30}>
        <Polygon fill="#12142b" points="15,26 0,0 30,0" />
      </Svg>
    </View>
  );
}

/**
 * Scratch card whose foil is removed where the finger travels.
 *
 * Replaces a six-by-four grid of tiles that vanished on touch: an SVG mask punches a hole at every
 * sampled point, so the covering is actually scratched away rather than snapped off in blocks.
 */
export function ScratchCard({
  children,
  height = 170,
  onRevealed,
  width = 300,
}: Readonly<{
  children: React.ReactNode;
  height?: number;
  onRevealed: () => void;
  width?: number;
}>) {
  const [points, setPoints] = useState<readonly { x: number; y: number }[]>([]);
  const revealed = useRef(false);
  const brush = 26;

  function addPoint(x: number, y: number) {
    if (revealed.current) return;
    setPoints((current) => {
      const last = current.at(-1);
      // Sampling every few pixels keeps the mask small without leaving gaps in the stroke.
      if (last && Math.hypot(last.x - x, last.y - y) < brush / 3) return current;
      const next = [...current, { x, y }];
      // Rough coverage: brush area times strokes against the card area, capped for overlap.
      const covered = (next.length * Math.PI * (brush / 2) ** 2 * 0.55) / (width * height);
      if (covered >= 0.45) {
        revealed.current = true;
        pulse("win");
        onRevealed();
      } else if (next.length % 4 === 0) {
        pulse("tick");
      }
      return next;
    });
  }

  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) =>
        addPoint(event.nativeEvent.locationX, event.nativeEvent.locationY)
      }
      onResponderMove={(event) =>
        addPoint(event.nativeEvent.locationX, event.nativeEvent.locationY)
      }
      style={{ height, width }}
    >
      <View style={styles.scratchPrizeLayer}>{children}</View>
      <Svg height={height} style={StyleSheet.absoluteFill} width={width}>
        <Defs>
          <Mask id="scratch-mask">
            <Rect fill="#ffffff" height={height} width={width} x={0} y={0} />
            {points.map((point, index) => (
              <Circle cx={point.x} cy={point.y} fill="#000000" key={index} r={brush} />
            ))}
          </Mask>
        </Defs>
        <Rect
          fill="#b9b2a6"
          height={height}
          mask="url(#scratch-mask)"
          rx={16}
          width={width}
          x={0}
          y={0}
        />
      </Svg>
    </View>
  );
}

/** Mystery box that shakes while the server resolves the prize, then bursts open. */
export function MysteryBox({
  opening,
  opened,
  size = 170,
}: Readonly<{ opening: boolean; opened: boolean; size?: number }>) {
  const shake = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!opening) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, {
          toValue: 1,
          duration: 90,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: -1,
          duration: 90,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opening, shake]);

  useEffect(() => {
    if (!opened) return;
    Animated.spring(lift, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [opened, lift]);

  const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ["-7deg", "7deg"] });
  const lidLift = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.42] });

  return (
    <Animated.View style={{ height: size, width: size, transform: [{ rotate }] }}>
      <Svg height={size} width={size}>
        <Rect fill="#c9822f" height={size * 0.58} rx={10} width={size} y={size * 0.42} />
        <Rect
          fill="#e5a13c"
          height={size * 0.58}
          width={size * 0.18}
          x={size * 0.41}
          y={size * 0.42}
        />
      </Svg>
      <Animated.View style={[styles.boxLid, { transform: [{ translateY: lidLift }] }]}>
        <Svg height={size * 0.3} width={size}>
          <Rect fill="#e5a13c" height={size * 0.3} rx={8} width={size} />
          <Rect fill="#f6c977" height={size * 0.3} width={size * 0.18} x={size * 0.41} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const CONFETTI_COLOURS = ["#e5a13c", "#16a394", "#6d28d9", "#f6c977", "#c8452f"];

/** Lightweight celebratory burst; no dependency, so it ships with the games rather than after. */
export function Confetti({ pieces = 22 }: Readonly<{ pieces?: number }>) {
  const progress = useRef(new Animated.Value(0)).current;
  const seeds = useMemo(
    () =>
      Array.from({ length: pieces }, (_, index) => ({
        key: index,
        drift: (Math.random() - 0.5) * 260,
        delay: Math.random() * 240,
        colour: CONFETTI_COLOURS[index % CONFETTI_COLOURS.length],
        size: 6 + Math.random() * 7,
      })),
    [pieces],
  );

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 1600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <View pointerEvents="none" style={styles.confetti}>
      {seeds.map((seed) => (
        <Animated.View
          key={seed.key}
          style={{
            backgroundColor: seed.colour,
            borderRadius: 2,
            height: seed.size,
            position: "absolute",
            width: seed.size * 0.6,
            opacity: progress.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
            transform: [
              {
                translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-20, 320] }),
              },
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, seed.drift],
                }),
              },
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "540deg"],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  boxLid: { left: 0, position: "absolute", right: 0, top: 0 },
  confetti: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "flex-start",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  pointer: { alignSelf: "center", position: "absolute", top: 0, zIndex: 2 },
  scratchPrizeLayer: {
    alignItems: "center",
    backgroundColor: "#fbf9f6",
    borderRadius: 16,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  wheelSvg: { position: "absolute", top: 26 },
});
