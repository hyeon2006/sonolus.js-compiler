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
): ReadonlyMap<K, V> => {
    const result = new Map<K, V>()
    let sameAsA = true
    let sameAsB = true

    for (const [key, valueA] of a) {
        const valueB = b.get(key)

        const value = merge(valueA, valueB)
        if (value === undefined) {
            sameAsA = false
            if (valueB !== undefined) sameAsB = false
            continue
        }

        if (value !== valueA) sameAsA = false
        if (value !== valueB) sameAsB = false

        result.set(key, value)
    }

    for (const [key, valueB] of b) {
        if (a.has(key)) continue

        const value = merge(undefined, valueB)
        if (value === undefined) {
            sameAsB = false
            continue
        }

        sameAsA = false
        if (value !== valueB) sameAsB = false

        result.set(key, value)
    }

    if (sameAsA && result.size === a.size) return a
    if (sameAsB && result.size === b.size) return b

    return result
}
