// The dock library's ambient types omit window sizing and hideTabs.
export interface PanelState {
  size?: number;
  minSize?: number;
  maxSize?: number;
  resize?: 'fixed' | 'dynamic' | 'stretch';
  windows: {
    selected: number;
    widgets: string[];
    size?: number;
    minSize?: number;
    maxSize?: number;
    resize?: 'fixed' | 'dynamic' | 'stretch';
    hideTabs?: boolean;
  }[];
}

type LayoutArea = 'panels' | 'workspace';
const storageKey = (type: string, area: LayoutArea) =>
  `breaditor.layout.v1.${encodeURIComponent(type)}.${area}`;

function dimensions(value: any) {
  const result: any = {};
  for (const key of ['size', 'minSize', 'maxSize']) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0) result[key] = value[key];
  }
  if (['fixed', 'dynamic', 'stretch'].includes(value.resize)) result.resize = value.resize;
  return result;
}

// Reconcile the saved catalog with today's panels: closed panels stay closed,
// removed panels disappear, and newly introduced panels start open.
export function loadPanelLayout(type: string, area: LayoutArea, ids: string[], fallback: PanelState[]): PanelState[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(type, area)) || 'null');
    if (!saved || !Array.isArray(saved.ids) || !saved.ids.every((id: unknown) => typeof id === 'string') || !Array.isArray(saved.layout)) return fallback;
    const seen = new Set<string>();
    const layout: PanelState[] = saved.layout.map((panel: any) => {
      if (!panel || !Array.isArray(panel.windows)) throw new Error('Invalid panel layout');
      const windows = panel.windows.map((win: any) => {
        if (!win || !Array.isArray(win.widgets) || !win.widgets.every((id: unknown) => typeof id === 'string')) throw new Error('Invalid window layout');
        const selectedId = win.widgets[win.selected];
        const widgets = win.widgets.filter((id: string) => {
          if (!ids.includes(id) || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        return {...dimensions(win), ...(win.hideTabs === true ? {hideTabs: true} : {}), widgets, selected: Math.max(0, widgets.indexOf(selectedId))};
      }).filter((win: any) => win.widgets.length);
      return {...dimensions(panel), windows};
    }).filter((panel: PanelState) => panel.windows.length);
    const added = ids.filter(id => !saved.ids.includes(id) && !seen.has(id));
    if (added.length) layout.push({windows: [{selected: 0, widgets: added}]});
    return layout;
  } catch {
    return fallback;
  }
}

export function savePanelLayout(type: string, area: LayoutArea, ids: string[], layout: PanelState[]) {
  try {
    localStorage.setItem(storageKey(type, area), JSON.stringify({ids, layout}));
  } catch {
    // Layout changes must still work if storage is unavailable or full.
  }
}
