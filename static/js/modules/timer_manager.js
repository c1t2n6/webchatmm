// Timer Manager Module
export class TimerManager {
    constructor() {
        this.timers = new Map();
        this.intervals = new Map();
        console.log('🔍 TimerManager - Initialized');
    }

    /**
     * Set a timeout timer
     * @param {string} id - Unique timer identifier
     * @param {Function} callback - Function to execute
     * @param {number} delay - Delay in milliseconds
     * @returns {number} Timer ID
     */
    setTimer(id, callback, delay) {
        this.clearTimer(id);
        const timer = setTimeout(() => {
            callback();
            this.timers.delete(id); // Auto-remove after execution
        }, delay);
        this.timers.set(id, timer);
        console.log(`🔍 TimerManager - Set timer: ${id} (${delay}ms)`);
        return timer;
    }

    /**
     * Set an interval timer
     * @param {string} id - Unique interval identifier
     * @param {Function} callback - Function to execute
     * @param {number} interval - Interval in milliseconds
     * @returns {number} Interval ID
     */
    setInterval(id, callback, interval) {
        this.clearInterval(id);
        const intervalId = setInterval(callback, interval);
        this.intervals.set(id, intervalId);
        console.log(`🔍 TimerManager - Set interval: ${id} (${interval}ms)`);
        return intervalId;
    }

    /**
     * Clear a specific timeout timer
     * @param {string} id - Timer identifier
     */
    clearTimer(id) {
        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(id);
            console.log(`🔍 TimerManager - Cleared timer: ${id}`);
        }
    }

    /**
     * Clear a specific interval timer
     * @param {string} id - Interval identifier
     */
    clearInterval(id) {
        const intervalId = this.intervals.get(id);
        if (intervalId) {
            clearInterval(intervalId);
            this.intervals.delete(id);
            console.log(`🔍 TimerManager - Cleared interval: ${id}`);
        }
    }

    /**
     * Clear all timers and intervals
     */
    clearAll() {
        // Clear all timeout timers
        this.timers.forEach((timer, id) => {
            clearTimeout(timer);
            console.log(`🔍 TimerManager - Cleared timer: ${id}`);
        });
        this.timers.clear();

        // Clear all interval timers
        this.intervals.forEach((intervalId, id) => {
            clearInterval(intervalId);
            console.log(`🔍 TimerManager - Cleared interval: ${id}`);
        });
        this.intervals.clear();

        console.log('🔍 TimerManager - All timers cleared');
    }

    /**
     * Get current timer count
     * @returns {Object} Count of active timers and intervals
     */
    getTimerCount() {
        return {
            timers: this.timers.size,
            intervals: this.intervals.size,
            total: this.timers.size + this.intervals.size
        };
    }

    /**
     * List all active timers
     * @returns {Array} Array of timer IDs
     */
    listActiveTimers() {
        return Array.from(this.timers.keys());
    }

    /**
     * List all active intervals
     * @returns {Array} Array of interval IDs
     */
    listActiveIntervals() {
        return Array.from(this.intervals.keys());
    }

    /**
     * Check if a timer exists
     * @param {string} id - Timer identifier
     * @returns {boolean} True if timer exists
     */
    hasTimer(id) {
        return this.timers.has(id);
    }

    /**
     * Check if an interval exists
     * @param {string} id - Interval identifier
     * @returns {boolean} True if interval exists
     */
    hasInterval(id) {
        return this.intervals.has(id);
    }
}
