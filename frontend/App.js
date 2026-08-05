import React, { useState, useRef } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Animated } from 'react-native';
import WelcomeScreen from './src/screens/WelcomeScreen';
import DetectionScreen from './src/screens/DetectionScreen';

export default function App() {
  const [screen, setScreen] = useState('Welcome');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const navigateTo = (targetScreen) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      setScreen(targetScreen);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#04050A" />
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        {screen === 'Welcome' ? (
          <WelcomeScreen onStart={() => navigateTo('Detection')} />
        ) : (
          <DetectionScreen />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#04050A',
  },
  flex: {
    flex: 1,
  },
});
