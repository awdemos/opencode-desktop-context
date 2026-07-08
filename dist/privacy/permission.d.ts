export type PermissionState = {
    granted: boolean;
    askedAt?: string;
};
export declare function loadPermissionState(): Promise<PermissionState>;
export declare function savePermissionState(state: PermissionState): Promise<void>;
export declare function hasGrantedPermission(state: PermissionState): boolean;
//# sourceMappingURL=permission.d.ts.map