import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { runOnJS, useFrameCallback } from 'react-native-reanimated';

export const FPSCounter = () => {
    const [fps, setFps] = useState(60);

    // Use REF for accounting to avoid re-renders
    const lastTime = React.useRef(0);
    const frameCount = React.useRef(0);

    useFrameCallback((frameInfo) => {
        if (!frameInfo.timeSincePreviousFrame) return;

        // Accumulate frames
        frameCount.current++;

        // Every 500ms update UI
        if (frameInfo.timestamp - lastTime.current >= 500) {
            const delta = frameInfo.timestamp - lastTime.current;
            const currentFps = Math.round((frameCount.current * 1000) / delta);

            runOnJS(setFps)(currentFps);

            lastTime.current = frameInfo.timestamp;
            frameCount.current = 0;
        }
    });

    return (
        <View
            style={styles.container}
            {...(Platform.OS !== 'web' ? { pointerEvents: 'none' } : {})}
        >
            <Text style={styles.text}>{fps} FPS</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 40,
        left: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 4,
        borderRadius: 4,
        pointerEvents: 'none',
    },
    text: {
        color: '#0f0',
        fontSize: 12,
        fontFamily: 'monospace',
        fontWeight: 'bold',
    }
});
