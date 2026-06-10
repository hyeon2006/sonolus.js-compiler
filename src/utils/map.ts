export const mapCompare = <K, V>(
    a: ReadonlyMap<K, V>,
    b: ReadonlyMap<K, V>,
    compare: (valueA: V, valueB: V) => unknown,
): boolean => {
    if (a === b) return true
    if (a.size !== b.size) return false

    for (const [key, valueA] of a) {
        const valueB = b.get(key)
        if (valueB === undefined) return false

        if (!compare(valueA, valueB)) return false
    }

    return true
}

export const mapMerge = <K, V>(
    a: ReadonlyMap<K, V>,
    b: ReadonlyMap<K, V>,
    merge: (valueA: V | undefined, valueB: V | undefined) => V | undefined,
): Map<K, V> => {
    const result = new Map<K, V>()

    for (const [key, valueA] of a) {
        const value = merge(valueA, b.get(key))
        if (value === undefined) continue

        result.set(key, value)
    }

    for (const [key, valueB] of b) {
        if (a.has(key)) continue

        const value = merge(undefined, valueB)
        if (value === undefined) continue

        result.set(key, value)
    }

    return result
}
