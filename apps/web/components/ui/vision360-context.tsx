import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface HistoryItem {
  type: string;
  id: string;
  name: string;
}

interface Vision360ContextProps {
  isOpen: boolean;
  entityType: string | null;
  entityId: string | null;
  historyStack: HistoryItem[];
  open: (type: string, id: string) => void;
  close: () => void;
  navigateTo: (type: string, id: string, name: string) => void;
  goBack: () => void;
}

const Vision360Context = createContext<Vision360ContextProps | undefined>(undefined);

export const Vision360Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [entityType, setEntityType] = useState<string | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [historyStack, setHistoryStack] = useState<HistoryItem[]>([]);

  const open = useCallback((type: string, id: string) => {
    setEntityType(type.toUpperCase());
    setEntityId(id);
    setHistoryStack([{ type: type.toUpperCase(), id, name: 'Origem' }]);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setEntityType(null);
    setEntityId(null);
    setHistoryStack([]);
  }, []);

  const navigateTo = useCallback((type: string, id: string, name: string) => {
    const formattedType = type.toUpperCase();
    setEntityType(formattedType);
    setEntityId(id);
    setHistoryStack((prev) => [...prev, { type: formattedType, id, name }]);
  }, []);

  const goBack = useCallback(() => {
    setHistoryStack((prev) => {
      if (prev.length <= 1) {
        close();
        return [];
      }
      const nextStack = prev.slice(0, -1);
      const last = nextStack[nextStack.length - 1];
      setEntityType(last.type);
      setEntityId(last.id);
      return nextStack;
    });
  }, [close]);

  const value = useMemo(
    () => ({
      isOpen,
      entityType,
      entityId,
      historyStack,
      open,
      close,
      navigateTo,
      goBack,
    }),
    [isOpen, entityType, entityId, historyStack, open, close, navigateTo, goBack]
  );

  return <Vision360Context.Provider value={value}>{children}</Vision360Context.Provider>;
};

export const useVision360 = () => {
  const context = useContext(Vision360Context);
  if (!context) {
    throw new Error('useVision360 deve ser usado dentro de um Vision360Provider');
  }
  return context;
};
