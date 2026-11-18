import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface UiState {
  notifications: Notification[];
}

const MAX_VISIBLE = 4;

const initialState: UiState = { notifications: [] };

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    showNotification: {
      reducer(state, action: PayloadAction<Notification>) {
        state.notifications.push(action.payload);
        // Keep only the most recent ones so the screen never fills up.
        state.notifications = state.notifications.slice(-MAX_VISIBLE);
      },
      prepare(notification: Omit<Notification, 'id'>) {
        return { payload: { ...notification, id: nanoid() } };
      },
    },
    hideNotification(state, action: PayloadAction<string>) {
      state.notifications = state.notifications.filter((n) => n.id !== action.payload);
    },
  },
});

export const { showNotification, hideNotification } = uiSlice.actions;
export default uiSlice.reducer;
