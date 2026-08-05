import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Animated floating blob component
function FloatingBlob({ style, color1, color2, delay = 0 }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 5000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  return (
    <Animated.View style={[style, { transform: [{ translateY }] }]}>
      <LinearGradient
        colors={[color1, color2]}
        style={{ width: '100%', height: '100%', borderRadius: 999 }}
      />
    </Animated.View>
  );
}

// Floating particle
function Particle({ x, y, size, delay }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 3000 + delay * 0.5, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 3000 + delay * 0.5, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 0.6, 0.1] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -15] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(139, 92, 246, 0.5)',
        opacity,
        transform: [{ translateY }],
      }}
    />
  );
}

// The Mirrorball AI Orb
function MirrorballOrb({ spinFast }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Float up/down
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 3500, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 3500, useNativeDriver: true }),
      ])
    );
    floatLoop.start();

    // Rotate
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: spinFast ? 1500 : 8000,
        useNativeDriver: true,
      })
    );
    rotateLoop.start();

    // Glow pulse
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    glowLoop.start();

    return () => {
      floatLoop.stop();
      rotateLoop.stop();
      glowLoop.stop();
    };
  }, [spinFast]);

  const floatY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });

  const ORB_SIZE = width * 1.1;

  return (
    <Animated.View
      style={{
        width: ORB_SIZE,
        height: ORB_SIZE,
        alignSelf: 'center',
        transform: [{ translateY: floatY }],
        marginBottom: -ORB_SIZE * 0.4, // clip bottom 40%
      }}
    >
      {/* Outer glow */}
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: ORB_SIZE / 2,
          backgroundColor: 'rgba(79, 123, 255, 0.12)',
          transform: [{ scale: 1.15 }],
          opacity: glowOpacity,
        }}
      />
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: ORB_SIZE / 2,
          backgroundColor: 'rgba(139, 92, 246, 0.08)',
          transform: [{ scale: 1.3 }],
          opacity: glowOpacity,
        }}
      />

      {/* The orb sphere with rotating gradient to simulate facets */}
      <Animated.View
        style={{
          width: ORB_SIZE,
          height: ORB_SIZE,
          borderRadius: ORB_SIZE / 2,
          overflow: 'hidden',
          transform: [{ rotate }],
        }}
      >
        <LinearGradient
          colors={['#C0C8FF', '#7B6FFF', '#4F7BFF', '#8B5CF6', '#D946EF', '#4F7BFF', '#2A2AFF', '#C0C8FF']}
          start={[0, 0]}
          end={[1, 1]}
          style={{ width: '100%', height: '100%' }}
        />
        {/* Facet overlays to give mirrorball effect */}
        {[...Array(8)].map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: ORB_SIZE * 0.25,
              height: ORB_SIZE * 0.25,
              borderRadius: 4,
              backgroundColor: `rgba(255,255,255,${0.04 + (i % 3) * 0.06})`,
              top: (i % 4) * (ORB_SIZE * 0.25),
              left: Math.floor(i / 4) * (ORB_SIZE * 0.5),
              transform: [{ rotate: `${i * 22}deg` }],
            }}
          />
        ))}
      </Animated.View>

      {/* Specular highlight */}
      <View
        style={{
          position: 'absolute',
          top: ORB_SIZE * 0.1,
          left: ORB_SIZE * 0.15,
          width: ORB_SIZE * 0.35,
          height: ORB_SIZE * 0.25,
          borderRadius: ORB_SIZE * 0.2,
          backgroundColor: 'rgba(255,255,255,0.25)',
          transform: [{ skewX: '-15deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: ORB_SIZE * 0.12,
          left: ORB_SIZE * 0.18,
          width: ORB_SIZE * 0.15,
          height: ORB_SIZE * 0.08,
          borderRadius: ORB_SIZE * 0.1,
          backgroundColor: 'rgba(255,255,255,0.55)',
        }}
      />
    </Animated.View>
  );
}

export default function WelcomeScreen({ onStart }) {
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(24)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(24)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0.95)).current;
  const buttonPressScale = useRef(new Animated.Value(1)).current;
  const spinFast = useRef(false);

  useEffect(() => {
    Animated.stagger(180, [
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(titleTranslateY, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(subtitleOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(subtitleTranslateY, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(buttonOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(buttonScale, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(buttonPressScale, { toValue: 0.96, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonPressScale, { toValue: 1, useNativeDriver: true }).start();
  };

  const particles = [
    { x: 30, y: 120, size: 4, delay: 0 },
    { x: width - 60, y: 180, size: 3, delay: 500 },
    { x: 80, y: height * 0.35, size: 5, delay: 1000 },
    { x: width - 40, y: height * 0.4, size: 3, delay: 200 },
    { x: 50, y: height * 0.6, size: 4, delay: 700 },
    { x: width * 0.4, y: 90, size: 3, delay: 300 },
    { x: width * 0.7, y: height * 0.5, size: 5, delay: 900 },
    { x: width * 0.2, y: height * 0.7, size: 3, delay: 1200 },
  ];

  return (
    <View style={styles.container}>
      {/* Deep dark background */}
      <LinearGradient
        colors={['#04050A', '#080C18', '#0D1025', '#080C18']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Ambient radial blobs */}
      <FloatingBlob
        style={styles.blob1}
        color1="rgba(79,123,255,0.18)"
        color2="rgba(139,92,246,0.08)"
        delay={0}
      />
      <FloatingBlob
        style={styles.blob2}
        color1="rgba(217,70,239,0.12)"
        color2="rgba(139,92,246,0.06)"
        delay={1200}
      />
      <FloatingBlob
        style={styles.blob3}
        color1="rgba(79,123,255,0.08)"
        color2="rgba(30,10,60,0.0)"
        delay={600}
      />

      {/* Particles */}
      {particles.map((p, i) => (
        <Particle key={i} x={p.x} y={p.y} size={p.size} delay={p.delay} />
      ))}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Orb — center to bottom, cut off ~40% */}
        <View style={styles.orbContainer}>
          <MirrorballOrb spinFast={spinFast.current} />
        </View>

        {/* Disclaimer below orb */}
        <View style={styles.disclaimerBadge}>
          <Text style={styles.disclaimerBadgeText}>
            ⚠️ Not medical advice. Please consult a licensed medical practitioner with any concerns. If you score high, we strongly recommend professional evaluation.
          </Text>
        </View>

        {/* Content area */}
        <View style={styles.contentArea}>
          <Animated.Text
            style={[
              styles.title,
              { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] },
            ]}
          >
            AI-Powered{'\n'}Eye Health Screening
          </Animated.Text>

          <Animated.Text
            style={[
              styles.subtitle,
              { opacity: subtitleOpacity, transform: [{ translateY: subtitleTranslateY }] },
            ]}
          >
            Diabetic retinopathy threatens everyone — with or without diabetes. A condition known to cause blindness, its early symptoms are often invisible. It can be cured if caught early by screening, provided by our AI.
          </Animated.Text>

          {/* Start Button */}
          <Animated.View
            style={[
              styles.buttonWrapper,
              { opacity: buttonOpacity, transform: [{ scale: buttonScale }, { scale: buttonPressScale }] },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={onStart}
            >
              <LinearGradient
                colors={['#4F7BFF', '#8B5CF6', '#D946EF']}
                start={[0, 0]}
                end={[1, 0]}
                style={styles.startButton}
              >
                <Text style={styles.startButtonText}>Start  →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.Text style={[styles.belowButtonNote, { opacity: subtitleOpacity }]}>
            Disclaimer: not official medical advice!
          </Animated.Text>
        </View>
      </ScrollView>
    </View>
  );
}

const ORB_SIZE = width * 1.1;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#04050A',
  },
  scrollContent: {
    flexGrow: 1,
  },
  blob1: {
    position: 'absolute',
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: width * 0.425,
    top: -width * 0.2,
    left: -width * 0.2,
    opacity: 0.7,
  },
  blob2: {
    position: 'absolute',
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    top: height * 0.25,
    right: -width * 0.25,
    opacity: 0.6,
  },
  blob3: {
    position: 'absolute',
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    bottom: height * 0.05,
    left: -width * 0.15,
    opacity: 0.5,
  },
  orbContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: height * 0.05,
    overflow: 'hidden',
    height: ORB_SIZE * 0.62,
  },
  disclaimerBadge: {
    marginHorizontal: 24,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
  },
  disclaimerBadgeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  contentArea: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 60,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 46,
    marginBottom: 18,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 26,
    marginBottom: 40,
    fontWeight: '400',
  },
  buttonWrapper: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
    marginBottom: 20,
  },
  startButton: {
    paddingVertical: 20,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  belowButtonNote: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    textAlign: 'center',
  },
});
