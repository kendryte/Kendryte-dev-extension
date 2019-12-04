// eslint-disable-next-line no-undef
export const vscode = process.env.NODE_ENV === 'development' ? undefined : acquireVsCodeApi()