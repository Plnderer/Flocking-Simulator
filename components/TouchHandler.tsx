import React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SharedValue, runOnJS } from 'react-native-reanimated';

export type TouchState = {
    active: number; // 0 or 1 (using number for easier shared value handling if generic)
    x: number;
    y: number;
    mode: number; // 0: none, 1: attract, 2: repel, 3: explode
};

interface TouchHandlerProps {
    children: React.ReactNode;
    touchState: SharedValue<TouchState>;
    onDoubleTap: () => void;
    onSettings: () => void;
}

export const TouchHandler = ({ children, touchState, onDoubleTap, onSettings }: TouchHandlerProps) => {
    const pan = Gesture.Pan()
        .onBegin((e) => {
            touchState.value = {
                active: 1,
                x: e.x,
                y: e.y,
                mode: 1, // Attract by default
            };
        })
        .onUpdate((e) => {
            touchState.value = {
                ...touchState.value,
                x: e.x,
                y: e.y,
            };
        })
        .onFinalize(() => {
            touchState.value = { ...touchState.value, active: 0, mode: 0 };
        });

    // Stable callback to reset touch state on JS thread
    const resetTouchState = React.useCallback(() => {
        setTimeout(() => {
            touchState.value = { ...touchState.value, active: 0, mode: 0 };
        }, 200);
    }, []);

    const longPress = Gesture.LongPress()
        .minDuration(400)
        .onStart((e) => {
            touchState.value = {
                active: 1,
                x: e.x,
                y: e.y,
                mode: 1, // Attract (Charging)
            };
        })
        .onFinalize((e) => {
            // Explode on release
            touchState.value = {
                active: 1,
                x: e.x, // Use last known position
                y: e.y,
                mode: 3, // Explode
            };

            // Reset after short delay to stop explosion
            runOnJS(resetTouchState)();
        });

    // Double tap
    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            runOnJS(onDoubleTap)();
        });

    // Edge swipe for settings (Right edge?)
    // For simplicity, maybe just a button or native gesture?
    // "Edge swipe: Open settings panel"
    // Let's implement that in the layout or with a specific gesture.
    // Using activeOffsetX for Pan?

    const composed = Gesture.Simultaneous(pan, longPress, doubleTap);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <GestureDetector gesture={composed}>
                <View style={{ flex: 1 }}>
                    {children}
                </View>
            </GestureDetector>
        </GestureHandlerRootView>
    );
};
