import Slider from '@react-native-community/slider';
import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CONSTRAINTS } from '../constants/defaults';
import { useSimulationStore } from '../lib/store/simulationStore';

// Helper for granular slider row
const SettingRow = ({
    label,
    value,
    setValue,
    min,
    max,
    step = 0.1,
    format = (v: number) => v.toFixed(1)
}: {
    label: string,
    value: number,
    setValue: (v: number) => void,
    min: number,
    max: number,
    step?: number,
    format?: (v: number) => string
}) => {
    return (
        <View style={styles.settingRow}>
            <View style={styles.labelContainer}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                    style={styles.valueInput}
                    keyboardType="numeric"
                    // Simple logic to keep it synced
                    defaultValue={format(value)}
                    onChangeText={(text) => {
                        const num = parseFloat(text);
                        if (!isNaN(num)) setValue(num);
                    }}
                />
            </View>
            <Slider
                style={styles.slider}
                minimumValue={min}
                maximumValue={max}
                step={step}
                value={value}
                onValueChange={setValue}
                minimumTrackTintColor="#2dd4bf"
                maximumTrackTintColor="#3f3f46"
                thumbTintColor="#99f6e4"
            />
        </View>
    );
};

export default function SettingsSheet({ onClose }: { onClose: () => void }) {
    const store = useSimulationStore();

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={styles.header}>Simulation Settings</Text>
                <TouchableOpacity onPress={onClose} style={{ padding: 8, backgroundColor: '#333', borderRadius: 8 }}>
                    <Text style={{ color: '#2dd4bf', fontWeight: 'bold' }}>Done</Text>
                </TouchableOpacity>
            </View>

            {/* Boid Count */}
            <SettingRow
                label="Boid Count"
                value={store.boidCount}
                setValue={(v: number) => store.set({ boidCount: Math.round(v) })}
                min={CONSTRAINTS.MIN_BOID_COUNT}
                max={CONSTRAINTS.MAX_BOID_COUNT}
                step={10}
                format={(v: number) => v.toFixed(0)}
            />

            {/* Perception */}
            <SettingRow
                label="Perception Radius"
                value={store.perceptionRadius}
                setValue={(v: number) => store.set({ perceptionRadius: v })}
                min={10} max={100}
                format={(v: number) => v.toFixed(0)}
            />

            {/* Max Speed */}
            <SettingRow
                label="Max Speed"
                value={store.maxSpeed}
                setValue={(v: number) => store.set({ maxSpeed: v })}
                min={CONSTRAINTS.MIN_SPEED} max={CONSTRAINTS.MAX_SPEED}
                format={(v: number) => v.toFixed(1)}
            />

            {/* Forces */}
            <SettingRow
                label="Separation Force"
                value={store.separationWeight}
                setValue={(v: number) => store.set({ separationWeight: v })}
                min={0} max={5}
            />
            <SettingRow
                label="Alignment Force"
                value={store.alignmentWeight}
                setValue={(v: number) => store.set({ alignmentWeight: v })}
                min={0} max={5}
            />
            <SettingRow
                label="Cohesion Force"
                value={store.cohesionWeight}
                setValue={(v: number) => store.set({ cohesionWeight: v })}
                min={0} max={5}
            />
            <SettingRow
                label="Max Steer Force"
                value={store.maxForce}
                setValue={(v: number) => store.set({ maxForce: v })}
                min={0} max={2} step={0.01}
                format={(v: number) => v.toFixed(2)}
            />

            {/* Physics */}
            <SettingRow
                label="Drag (Friction)"
                value={store.drag}
                setValue={(v: number) => store.set({ drag: v })}
                min={0} max={0.2} step={0.001}
                format={(v: number) => v.toFixed(3)}
            />

            <SettingRow
                label="Noise (Jitter)"
                value={store.noise}
                setValue={(v: number) => store.set({ noise: v })}
                min={0} max={2}
            />

            <SettingRow
                label="Alignment Bias"
                value={store.alignmentBias}
                setValue={(v: number) => store.set({ alignmentBias: v })}
                min={0} max={4}
            />

            {/* Toggles */}
            <View style={styles.toggleRow}>
                <Text style={styles.label}>Bounce Off Walls</Text>
                <Switch
                    value={store.bounce}
                    onValueChange={(v) => store.set({ bounce: v })}
                    trackColor={{ false: '#3f3f46', true: '#2dd4bf' }}
                    thumbColor={'#fff'}
                />
            </View>

            <Text style={styles.sectionHeader}>Visuals</Text>
            <View style={styles.toggleRow}>
                <Text style={styles.label}>Color Mode: {store.colorMode.toUpperCase()}</Text>
                <Switch
                    value={store.colorMode !== 'solid'}
                    onValueChange={(v) => {
                        const next = store.colorMode === 'solid' ? 'velocity' : (store.colorMode === 'velocity' ? 'rainbow' : 'solid');
                        store.set({ colorMode: next });
                    }}
                    trackColor={{ false: '#3f3f46', true: '#2dd4bf' }}
                />
            </View>
            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09090b',
    },
    content: {
        padding: 20,
        paddingBottom: 50,
    },
    header: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    sectionHeader: {
        color: '#2dd4bf',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 10,
    },
    settingRow: {
        marginBottom: 16,
    },
    labelContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    label: {
        color: '#e4e4e7',
        fontSize: 14,
    },
    valueInput: {
        color: '#2dd4bf',
        backgroundColor: '#18181b',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        minWidth: 50,
        textAlign: 'right',
        fontSize: 14,
    },
    slider: {
        width: '100%',
        height: 40,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: '#18181b',
        padding: 12,
        borderRadius: 8,
    },
});
