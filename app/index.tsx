import { FPSCounter } from '@/components/FPSCounter';
import SettingsSheet from '@/components/SettingsSheet';
import { useSimulationStore } from '@/lib/store/simulationStore';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
                <SafeAreaView style={styles.controlsContainer} edges={['bottom', 'left', 'right']} pointerEvents="box-none">
                    <BlurView intensity={30} tint="dark" style={styles.controlBar}>
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={togglePlay}
                        >
                            <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="#fff" />
                        </TouchableOpacity>

                        {!isPlaying && (
                            <>
                                <View style={styles.divider} />
                                <TouchableOpacity
                                    style={styles.iconButton}
                                    onPress={useSimulationStore.getState().nextFrame}
                                >
                                    <Ionicons name="play-skip-forward" size={24} color="#fff" />
                                </TouchableOpacity>
                            </>
                        )}

                        <View style={styles.divider} />

                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => setSettingsVisible(true)}
                        >
                            <Ionicons name="settings-sharp" size={26} color="#fff" />
                        </TouchableOpacity>
                    </BlurView>
                </SafeAreaView>
            )}

            {/* Modal for Settings Sheet */}
            <React.Fragment>
                {settingsVisible && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                        <SettingsSheet onClose={() => setSettingsVisible(false)} />
                    </View>
                )}
            </React.Fragment>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    controlsContainer: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
    },
    controlBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 30,
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    iconButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginHorizontal: 5,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
