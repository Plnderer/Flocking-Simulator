import Slider from '@react-native-community/slider';
import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONSTRAINTS } from '../constants/defaults';
import { useSimulationStore } from '../lib/store/simulationStore';

interface SettingsSheetProps {
    visible: boolean;
    onClose: () => void;
}

const ControlRow = ({ label, value, onValueChange, min, max, step = 0.1 }: any) => (
    <View style={styles.row}>
        <View style={styles.labelContainer}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value.toFixed(1)}</Text>
        </View>
        <Slider
            style={{ height: 40 }}
            minimumValue={min}
            maximumValue={max}
            step={step}
            value={value}
            onValueChange={onValueChange}
            minimumTrackTintColor="#1FB28A"
            maximumTrackTintColor="#d3d3d3"
            thumbTintColor="#b9e4c9"
        />
    </View>
);

export const SettingsSheet = ({ visible, onClose }: SettingsSheetProps) => {
    const store = useSimulationStore();
    const insets = useSafeAreaInsets();

    if (!visible) return null;

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Simulation Settings</Text>
                <TouchableOpacity onPress={onClose}>
                    <Text style={styles.closeBtn}>Done</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                <ControlRow
                    label="Boid Count"
                    value={store.boidCount}
                    min={CONSTRAINTS.MIN_BOID_COUNT}
                    max={CONSTRAINTS.MAX_BOID_COUNT}
                    step={50}
                    onValueChange={store.setBoidCount}
                />
                <ControlRow
                    label="Perception Radius"
                    value={store.perceptionRadius}
                    min={CONSTRAINTS.MIN_PERCEPTION}
                    max={CONSTRAINTS.MAX_PERCEPTION}
                    step={1}
                    onValueChange={store.setPerceptionRadius}
                />
                <ControlRow
                    label="Max Speed"
                    value={store.maxSpeed}
                    min={CONSTRAINTS.MIN_SPEED}
                    max={CONSTRAINTS.MAX_SPEED}
                    step={0.5}
                    onValueChange={store.setMaxSpeed}
                />
                <ControlRow
                    label="Separation"
                    value={store.separationWeight}
                    min={0} max={5}
                    onValueChange={store.setSeparationWeight}
                />
                <ControlRow
                    label="Alignment"
                    value={store.alignmentWeight}
                    min={0} max={5}
                    onValueChange={store.setAlignmentWeight}
                />
                <ControlRow
                    label="Cohesion"
                    value={store.cohesionWeight}
                    min={0} max={5}
                    onValueChange={store.setCohesionWeight}
                />

                <View style={styles.switchRow}>
                    <Text style={styles.label}>Dark Mode</Text>
                    <Switch value={store.theme === 'dark'} onValueChange={store.toggleTheme} />
                </View>

                <View style={styles.switchRow}>
                    <Text style={styles.label}>Debug View</Text>
                    <Switch value={store.showDebug} onValueChange={store.toggleDebug} />
                </View>

                <View style={styles.section}>
                    <Text style={[styles.label, { marginBottom: 10 }]}>Color Mode</Text>
                    <View style={styles.segmentContainer}>
                        {['solid', 'velocity', 'rainbow'].map((mode) => (
                            <TouchableOpacity
                                key={mode}
                                style={[
                                    styles.segmentBtn,
                                    store.colorMode === mode && styles.segmentBtnActive
                                ]}
                                onPress={() => store.setColorMode(mode as any)}
                            >
                                <Text style={[
                                    styles.segmentText,
                                    store.colorMode === mode && styles.segmentTextActive
                                ]}>
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <TouchableOpacity style={styles.resetBtn} onPress={store.resetDefaults}>
                    <Text style={styles.resetText}>Reset Defaults</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(20, 20, 30, 0.95)',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '60%',
        zIndex: 100,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeBtn: {
        color: '#1FB28A',
        fontSize: 16,
        fontWeight: '600',
    },
    content: {
        padding: 16,
    },
    row: {
        marginBottom: 20,
    },
    labelContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    label: {
        color: '#ccc',
        fontSize: 14,
    },
    value: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    resetBtn: {
        alignItems: 'center',
        padding: 12,
        marginTop: 10,
        marginBottom: 20,
        backgroundColor: '#333',
        borderRadius: 8,
    },
    resetText: {
        color: '#ff6b6b',
        fontWeight: 'bold',
    },
    section: {
        marginBottom: 20,
    },
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: '#333',
        borderRadius: 8,
        padding: 4,
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    segmentBtnActive: {
        backgroundColor: '#555',
    },
    segmentText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
    },
    segmentTextActive: {
        color: '#fff',
    }
});
