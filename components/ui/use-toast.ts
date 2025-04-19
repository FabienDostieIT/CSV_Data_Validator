"use client";

// Inspired by react-hot-toast library
import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

// Define the action types constant
const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  const idAsString = String(toastId);

  if (toastTimeouts.has(idAsString)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(idAsString);
    dispatch({
      type: actionTypes.REMOVE_TOAST,
      toastId: idAsString,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(idAsString, timeout);
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case actionTypes.ADD_TOAST: {
      const newToasts: ToasterToast[] = [action.toast, ...state.toasts].slice(0, TOAST_LIMIT);
      return {
        ...state,
        toasts: newToasts,
      };
    }
    case actionTypes.UPDATE_TOAST: {
      const updatedToasts = state.toasts.map((t): ToasterToast => 
        t.id === action.toast.id ? ({ ...t, ...action.toast } as ToasterToast) : t 
      );
      return {
        ...state,
        toasts: updatedToasts,
      };
    }
    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;

      if (toastId !== undefined) {
        addToRemoveQueue(String(toastId));
        const dismissedToasts = state.toasts.map((t): ToasterToast => 
          t.id === toastId
            ? { ...t, open: false }
            : t
        );
        return {
          ...state,
          toasts: dismissedToasts,
        };
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
        const allDismissedToasts = state.toasts.map((t): ToasterToast => ({ 
          ...t, 
          open: false 
        }));
        return {
          ...state,
          toasts: allDismissedToasts,
        };
      }
    }
    case actionTypes.REMOVE_TOAST: {
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      const filteredToasts = state.toasts.filter(
        (t): t is ToasterToast => t.id !== action.toastId,
      );
      return {
        ...state,
        toasts: filteredToasts,
      };
    }
    default:
        // Check if the action type is one of the known types
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-assignment
        const _exhaustiveCheck: never = action.type;
        return state; 
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

interface UseToastReturn extends State {
  toast: typeof toast;
  dismiss: (toastId?: string) => void;
}

function useToast(): UseToastReturn {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  };
}

export { useToast, toast };
