import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CONSTRAINTS } from '../constants/defaults';
import { useSimulationStore } from '../lib/store/simulationStore';

// Helper for granular slider row
const SettingRow = ({
    label,
    icon,
    value,
    setValue,
    min,
    max,
    step = 0.1,
    format = (v: number) => v.toFixed(1)
}: {
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    value: number,
    setValue: (v: number) => void,
    min: number,
    max: number,
    step?: number,
    format?: (v: number) => string
}) => {
    // Local state to keep text input in sync but allow typing
    const [textValue, setTextValue] = React.useState(format(value));

    // Sync text when prop changes (e.g. Reset pressed)
    React.useEffect(() => {
        setTextValue(format(value));
    }, [value]);

    return (
        <View style={styles.settingRow}>
            <View style={styles.labelContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name={icon} size={18} color="#2dd4bf" />
                    <Text style={styles.label}>{label}</Text>
                </View>
                <TextInput
                    style={styles.valueInput}
                    keyboardType="numeric"
                    value={textValue}
                    onChangeText={(text) => {
                        setTextValue(text);
                        const num = parseFloat(text);
                        if (!isNaN(num)) {
                            // Clamp logic optional, or just let store handle it
                            setValue(num);
                        }
                    }}
                    onBlur={() => {
                        // On blur, re-format to ensure it looks clean
                        setTextValue(format(value));
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
        <Modal
            animationType="slide"
            transparent={true}
            visible={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                {/* Invisible closer for top part */}
                <Pressable style={styles.backdrop} onPress={onClose} />

                {/* The actual sheet content */}
                <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
                    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1 }}>
                        <View style={styles.handleBar} />

                        <View style={styles.headerRow}>
                            <Text style={styles.header}>Simulation Settings</Text>
                            <TouchableOpacity onPress={onClose} style={styles.doneButton}>
                                <Text style={styles.doneButtonText}>Done</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.content}>
                            {/* Boid Count */}
                            <SettingRow
                                label="Boid Count"
                                icon="people-outline"
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
                                icon="eye-outline"
                                value={store.perceptionRadius}
                                setValue={(v: number) => store.set({ perceptionRadius: v })}
                                min={10} max={CONSTRAINTS.MAX_PERCEPTION}
                                format={(v: number) => v.toFixed(0)}
                            />

                            {/* Max Speed */}
                            <SettingRow
                                label="Max Speed"
                                icon="speedometer-outline"
                                value={store.maxSpeed}
                                setValue={(v: number) => store.set({ maxSpeed: v })}
                                min={CONSTRAINTS.MIN_SPEED} max={CONSTRAINTS.MAX_SPEED}
                                format={(v: number) => v.toFixed(1)}
                            />

                            {/* Forces */}
                            <Text style={styles.subHeader}>Forces</Text>
                            <SettingRow
                                label="Separation"
                                icon="expand-outline"
                                value={store.separationWeight}
                                setValue={(v: number) => store.set({ separationWeight: v })}
                                min={0} max={5}
                            />
                            <SettingRow
                                label="Alignment"
                                icon="filter-outline"
                                value={store.alignmentWeight}
                                setValue={(v: number) => store.set({ alignmentWeight: v })}
                                min={0} max={5}
                            />
                            <SettingRow
                                label="Cohesion"
                                icon="magnet-outline"
                                value={store.cohesionWeight}
                                setValue={(v: number) => store.set({ cohesionWeight: v })}
                                min={0} max={5}
                            />
                            <SettingRow
                                label="Max Steer"
                                icon="navigate-circle-outline"
                                value={store.maxForce}
                                setValue={(v: number) => store.set({ maxForce: v })}
                                min={0} max={CONSTRAINTS.MAX_FORCE} step={0.01}
                                format={(v: number) => v.toFixed(2)}
                            />

                            {/* Physics */}
                            <Text style={styles.subHeader}>Physics & Behavior</Text>
                            <SettingRow
                                label="Drag (Friction)"
                                icon="snow-outline"
                                value={store.drag}
                                setValue={(v: number) => store.set({ drag: v })}
                                min={0} max={0.2} step={0.001}
                                format={(v: number) => v.toFixed(3)}
                            />

                            <SettingRow
                                label="Noise (Jitter)"
                                icon="pulse-outline"
                                value={store.noise}
                                setValue={(v: number) => store.set({ noise: v })}
                                min={0} max={2}
                            />

                            <SettingRow
                                label="Bias"
                                icon="compass-outline"
                                value={store.alignmentBias}
                                setValue={(v: number) => store.set({ alignmentBias: v })}
                                min={0} max={4}
                            />

                            {/* Toggles */}
                            <View style={styles.toggleRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="cube-outline" size={18} color="#e4e4e7" />
                                    <Text style={styles.label}>Bounce Off Walls</Text>
                                </View>
                                <Switch
                                    value={store.bounce}
                                    onValueChange={(v) => store.set({ bounce: v })}
                                    trackColor={{ false: '#3f3f46', true: '#2dd4bf' }}
                                    thumbColor={'#fff'}
                                />
                            </View>

                            <Text style={styles.sectionHeader}>Visuals</Text>

                            {/* Particle Mode */}
                            <View style={styles.toggleRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="shapes-outline" size={18} color="#e4e4e7" />
                                    <Text style={styles.label}>Shape</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {['triangle', 'circle'].map((m) => (
                                        <TouchableOpacity
                                            key={m}
                                            onPress={() => store.set({ particleMode: m as any })}
                                            style={[
                                                styles.segmentButton,
                                                store.particleMode === m && styles.segmentButtonActive
                                            ]}
                                        >
                                            <Text style={[
                                                styles.segmentText,
                                                store.particleMode === m && styles.segmentTextActive
                                            ]}>
                                                {m.charAt(0).toUpperCase() + m.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Color Mode */}
                            <View style={{ marginBottom: 16 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <Ionicons name="color-palette-outline" size={18} color="#e4e4e7" />
                                    <Text style={styles.label}>Color Mode</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {['solid', 'velocity', 'rainbow'].map((m) => (
                                        <TouchableOpacity
                                            key={m}
                                            onPress={() => store.set({ colorMode: m as any })}
                                            style={[
                                                styles.segmentButton,
                                                store.colorMode === m && styles.segmentButtonActive,
                                                { flex: 1 }
                                            ]}
                                        >
                                            <Text style={[
                                                styles.segmentText,
                                                store.colorMode === m && styles.segmentTextActive
                                            ]}>
                                                {m.charAt(0).toUpperCase() + m.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Debug & Overlays */}
                            <Text style={styles.sectionHeader}>Debug</Text>

                            <View style={styles.toggleRow}>
                                <Text style={styles.label}>Show Vision Radius</Text>
                                <Switch
                                    value={store.showVision}
                                    onValueChange={(v) => store.set({ showVision: v })}
                                    trackColor={{ false: '#3f3f46', true: '#2dd4bf' }}
                                    thumbColor={'#fff'}
                                />
                            </View>

                            <View style={styles.toggleRow}>
                                <Text style={styles.label}>Show Direction Vectors</Text>
                                <Switch
                                    value={store.showDirection}
                                    onValueChange={(v) => store.set({ showDirection: v })}
                                    trackColor={{ false: '#3f3f46', true: '#2dd4bf' }}
                                    thumbColor={'#fff'}
                                />
                            </View>

                            <View style={styles.toggleRow}>
                                <Text style={styles.label}>Show Stats / FPS</Text>
                                <Switch
                                    value={store.showDebug}
                                    onValueChange={(v) => store.set({ showDebug: v })}
                                    trackColor={{ false: '#3f3f46', true: '#2dd4bf' }}
                                    thumbColor={'#fff'}
                                />
                            </View>

                            <View style={{ height: 20 }} />

                            <TouchableOpacity
                                onPress={() => store.resetDefaults()}
                                style={styles.resetButton}
                            >
                                <Text style={styles.resetButtonText}>Reset to Defaults</Text>
                            </TouchableOpacity>

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </SafeAreaView>
                </BlurView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)', // Slight dim for the top part
    },
    blurContainer: {
        height: '45%', // Partial height
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        backgroundColor: 'rgba(9, 9, 11, 0.85)', // Dark translucent background
        // Shadow for elevation
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    handleBar: {
        width: 40,
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 3,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 5,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    header: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    doneButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
    },
    doneButtonText: {
        color: '#2dd4bf',
        fontWeight: '600',
        fontSize: 14,
    },
    scrollContainer: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    sectionHeader: {
        color: '#2dd4bf',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 10,
    },
    subHeader: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: 12,
        marginBottom: 8,
        letterSpacing: 1,
    },
    settingRow: {
        marginBottom: 20,
    },
    labelContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        color: '#e4e4e7',
        fontSize: 14,
        fontWeight: '500',
    },
    valueInput: {
        color: '#2dd4bf',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        minWidth: 50,
        textAlign: 'right',
        fontSize: 14,
        fontWeight: '600',
    },
    slider: {
        width: '100%',
        height: 40,
        opacity: 0.9,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 14,
        borderRadius: 12,
    },
    segmentButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentButtonActive: {
        backgroundColor: '#2dd4bf',
    },
    segmentText: {
        color: '#a1a1aa',
        fontSize: 13,
        fontWeight: '600',
    },
    segmentTextActive: {
        color: '#09090b',
    },
    resetButton: {
        marginTop: 10,
        padding: 16,
        backgroundColor: 'rgba(239, 68, 68, 0.2)', // red-500 with opacity
        borderWidth: 1,
        borderColor: '#ef4444',
        borderRadius: 12,
        alignItems: 'center',
    },
    resetButtonText: {
        color: '#ef4444',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
