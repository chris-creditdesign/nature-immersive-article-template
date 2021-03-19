import { writable } from "svelte/store";

// The initial value is false as we don't know what the
// readers preferences will be
export const allowAnimation = writable(false);
