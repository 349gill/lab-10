#version 120 

// (way more precision than a float can actually store...)
#define LOG_2 0.6931471805599453094172321214581765680755001

// start using these antialiasing values once you start (c)
#define AA 2
const int TOTAL_SAMPLES = AA * AA;

uniform vec2 c;
uniform int MAX_ITERS;
uniform vec2 windowSizePixels;
uniform vec2 camCenterWorld;
uniform float camWorldUnitsPerPixel;

uniform bool UseOld;
uniform sampler2D OldFrame;
uniform vec2 OldCamCenterWorld;
uniform float OldCamWorldUnitsPerPixel;
const float TrueMaxIters = 16384.0; // (same as main.cpp)

// Use this to get a color from your smoothed Julia set escape times.
vec4 colorTime(float t) {
    return vec4(0.5 + 0.5 * cos(  0.1 * (t) + vec3(0.f, 0.35, 0.7)), 1.f);
}

struct EscapeTime {
    float iters;
    bool isInf;
};

// Escape time of iterating z^2 + c
EscapeTime escapeTimeSmooth(vec2 z) {
    for (int Iter = 0; Iter < MAX_ITERS; ++Iter) {
        float RSquared = dot(z, z);
        if (RSquared > 16.0) {
            return EscapeTime(float(Iter) + 2.0 - log(log(sqrt(RSquared))) / LOG_2, false);
        }
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    }
    return EscapeTime(0.0, true);
}


vec2 windowToWorld(vec2 windowCoords) {
    return camCenterWorld + (windowCoords - 0.5 * windowSizePixels) * camWorldUnitsPerPixel;
}

// For reprojection
vec2 worldToOldWindow(vec2 worldCoords) {
    return (worldCoords - OldCamCenterWorld) / OldCamWorldUnitsPerPixel + 0.5 * windowSizePixels;
}

// For SSAA
// Given (dx, dy) in [0, AA)^2, suppose the unit square [0, 1)^2 was cut up into AA equal
// partitions along each dimension. delta((dx, dy)) returns the center of the sub-square
// which is in the dy'th row and dx'th column (both 0-indexed).
vec2 delta(vec2 dxy) {
    return (dxy + 0.5) / float(AA);
}


void main() {
    vec2 PixelCorner = floor(gl_FragCoord.xy);
    vec4 Sum = vec4(0.0);

    for (int Dy = 0; Dy < AA; ++Dy) {
        for (int Dx = 0; Dx < AA; ++Dx) {
            vec2 World = windowToWorld(PixelCorner + delta(vec2(float(Dx), float(Dy))));

            EscapeTime Et = escapeTimeSmooth(World);
            
            vec4 NewColor = Et.isInf ? vec4(0.0, 0.0, 0.0, 1.0) : colorTime(Et.iters);

            vec4 Result = NewColor;

            if (UseOld) {
                vec2 OldWin = worldToOldWindow(World);
                if (all(greaterThanEqual(OldWin, vec2(0.5))) &&
                    all(lessThanEqual(OldWin, windowSizePixels - 0.5))) {
                    vec4 OldColor = texture2D(OldFrame, OldWin / windowSizePixels);
                    float Alpha = clamp(float(MAX_ITERS) / TrueMaxIters, 0.0, 1.0);
                    Result = mix(OldColor, NewColor, Alpha);
                }
            }
            Sum += Result;
        }
    }
    gl_FragColor = Sum / float(TOTAL_SAMPLES);
}
