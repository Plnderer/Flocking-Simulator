import { FPSCounter } from '@/components/FPSCounter';
import { SettingsSheet } from '@/components/SettingsSheet';
import { TouchHandler, TouchState } from '@/components/TouchHandler';
import { useSimulationStore } from '@/lib/store/simulationStore';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

// Lazy load SimulationCanvas to prevent Skia import execution before Web initialization
const SimulationCanvas = React.lazy(() =>
    import('@/components/SimulationCanvas').then(module => ({ default: module.SimulationCanvas }))
);

export default function HomeScreen() {
    const [settingsVisible, setSettingsVisible] = useState(false);
    const touchState = useSharedValue<TouchState>({ active: 0, x: 0, y: 0, mode: 0 });
    const showDebug = useSimulationStore(s => s.showDebug);
    const isPlaying = useSimulationStore(s => s.isPlaying);
    const togglePlay = useSimulationStore(s => s.togglePlay);

    // Web Skia Loading
    const [skiaReady, setSkiaReady] = useState(Platform.OS !== 'web');

    useEffect(() => {
        if (Platform.OS === 'web') {
            import('@shopify/react-native-skia/lib/module/web').then((module) => {
                module.LoadSkiaWeb().then(() => {
                    setSkiaReady(true);
                }).catch(err => console.error("Skia Web Load Failed", err));
            });
        }
    }, []);

    const handleDoubleTap = () => {
        // Explosion Effect
        touchState.value = { ...touchState.value, active: 1, mode: 3 };
        setTimeout(() => {
            touchState.value = { ...touchState.value, active: 0, mode: 0 };
        }, 300);
    };

    return (
        <View style={styles.container}>
            <StatusBar style="auto" hidden />

            {skiaReady ? (
                <TouchHandler
                    touchState={touchState}
                    onDoubleTap={handleDoubleTap}
                    onSettings={() => setSettingsVisible(true)}
                >
                    <React.Suspense fallback={<ActivityIndicator style={{ position: 'absolute' }} />}>
                        <SimulationCanvas touchState={touchState} />
                    </React.Suspense>
                </TouchHandler>
            ) : (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#1FB28A" />
                    <Text style={{ color: 'gray', marginTop: 10 }}>Loading Simulation...</Text>
                </View>
            )}

            {/* UI Overlays */}
            {showDebug && <FPSCounter />}

            {!settingsVisible && (
                <>
                    <TouchableOpacity
                        style={styles.playButton}
                        onPress={togglePlay}
                    >
                        <Text style={styles.gearIcon}>{isPlaying ? '⏸️' : '▶️'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.settingsButton}
                        onPress={() => setSettingsVisible(true)}
                    >
                        <Text style={styles.gearIcon}>⚙️</Text>
                    </TouchableOpacity>
                </>
            )}

            <SettingsSheet
                visible={settingsVisible}
                onClose={() => setSettingsVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    settingsButton: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50,
    },
    gearIcon: {
        fontSize: 24,
    },
    playButton: {
        position: 'absolute',
        bottom: 30,
        right: 80,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
