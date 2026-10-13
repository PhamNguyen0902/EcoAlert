import React, { memo, useId } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
import type { HeroMotion } from "./useHeroMotion";

// Composed closed terrain contours; path geometry stays static on the UI thread.
const contours = [
  "M 95 -22 C 191 -56 187 17 275 10 C 372 2 455 40 430 123 C 407 196 337 156 286 230 C 241 294 126 314 85 238 C 39 158 -27 100 31 37 C 49 16 76 -7 95 -22 Z",
  "M 114 -4 C 195 -28 201 38 280 30 C 361 20 429 53 408 116 C 386 174 324 153 270 218 C 228 267 145 283 105 222 C 62 155 4 104 49 54 C 69 30 91 5 114 -4 Z",
  "M 133 17 C 195 0 212 59 283 51 C 348 41 399 67 385 112 C 370 153 310 148 254 204 C 217 241 159 247 122 203 C 86 158 37 114 72 75 C 92 52 112 25 133 17 Z",
  "M 151 41 C 198 27 222 79 280 73 C 331 68 370 78 359 111 C 348 141 293 148 242 183 C 209 207 172 222 141 186 C 112 152 65 123 94 94 C 113 74 127 48 151 41 Z",
  "M 164 66 C 204 52 229 100 280 95 C 311 92 341 93 333 114 C 322 137 280 139 229 164 C 203 178 176 195 155 170 C 136 146 99 129 117 112 C 138 92 144 73 164 66 Z",
  "M 178 92 C 201 86 230 119 270 115 C 292 112 309 118 298 127 C 285 140 258 138 223 148 C 198 157 176 170 162 152 C 146 136 139 132 149 120 C 156 111 165 96 178 92 Z",
  "M 247 -30 C 313 22 365 -5 423 33 M -22 177 C 53 185 34 263 98 284 M 303 278 C 324 219 397 247 436 181",
  "M 275 -31 C 323 0 376 -17 434 14 M -26 203 C 28 207 24 278 77 303 M 329 286 C 351 241 400 266 448 206",
];

export const AnimatedTopographicBackground = memo(
  function AnimatedTopographicBackground({
    motion,
    dark,
  }: {
    motion: HeroMotion;
    dark: boolean;
  }) {
    const id = useId().replace(/:/g, "");
    const animated = useAnimatedStyle(() => ({
      opacity: dark
        ? 0.1 + motion.drift.value * 0.06
        : 0.08 + motion.drift.value * 0.035,
      transform: [
        { translateX: motion.drift.value * 7 - 3 },
        { translateY: motion.drift.value * 5 - 2 },
      ],
    }));
    return (
      <Animated.View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.layer, animated]}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 400 280"
          preserveAspectRatio="xMidYMid slice"
        >
          <Defs>
            <RadialGradient id={id} cx="68%" cy="45%" rx="48%" ry="62%">
              <Stop offset="0" stopColor="#22C55E" stopOpacity={0.8} />
              <Stop offset="1" stopColor="#22C55E" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="275" cy="132" rx="190" ry="165" fill={`url(#${id})`} />
          <G fill="none" strokeWidth={0.9}>
            {contours.map((d, i) => (
              <Path
                key={i}
                d={d}
                stroke={i % 3 === 0 ? "#4ADE80" : "#38BDF8"}
              />
            ))}
            <Path
              d="M 269 0 L 269 280 M 0 195 L 400 195"
              stroke="#38BDF8"
              strokeDasharray="1 7"
              strokeOpacity={0.6}
            />
          </G>
          <Circle cx="269" cy="195" r="3" fill="#4ADE80" />
          <Circle
            cx="269"
            cy="195"
            r="9"
            fill="none"
            stroke="#4ADE80"
            strokeWidth={0.6}
          />
        </Svg>
      </Animated.View>
    );
  },
);
const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    top: -10,
    left: -10,
    bottom: -10,
    right: -10,
  },
});
