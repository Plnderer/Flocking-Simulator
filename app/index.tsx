import { FPSCounter } from '@/components/FPSCounter';
import SettingsSheet from '@/components/SettingsSheet';
import { useSimulationStore } from '@/lib/store/simulationStore';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Lazy load SimulationCanvas
const SimulationCanvas = React.lazy(() => import('@/components/SimulationCanvas'));

export default function HomeScreen() {
    const [settingsVisible, setSettingsVisible] = useState(false);
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

    return (
        <View style={styles.container}>
            <StatusBar style="auto" hidden />

            {skiaReady ? (
                <React.Suspense fallback={<ActivityIndicator style={{ position: 'absolute' }} />}>
                    <SimulationCanvas />
                </React.Suspense>
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

            {settingsVisible && (
                <View style={StyleSheet.absoluteFill}>
                    <SettingsSheet onClose={() => setSettingsVisible(false)} />
                </View>
            )}
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
