// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

library IterableMapping {
    // Iterable mapping from uint256 to uint256;
    struct Map {
        uint256[] keys;
        mapping(uint256 => uint256) values;
        mapping(uint256 => uint) indexOf;
        mapping(uint256 => bool) inserted;
    }

    function get(Map storage map, uint256 key) public view returns (uint) {
        return map.values[key];
    }

    function getKeyAtIndex(Map storage map, uint index) public view returns (uint256) {
        return map.keys[index];
    }

    function size(Map storage map) public view returns (uint) {
        return map.keys.length;
    }

    function set(
        Map storage map,
        uint256 key,
        uint256 val
    ) public {
        if (map.inserted[key]) {
            map.values[key] = val;
        } else {
            map.inserted[key] = true;
            map.values[key] = val;
            map.indexOf[key] = map.keys.length;
            map.keys.push(key);
        }
    }

    function remove(Map storage map, uint256 key) public {
        if (!map.inserted[key]) {
            return;
        }

        delete map.inserted[key];
        delete map.values[key];

        uint index = map.indexOf[key];
        uint lastIndex = map.keys.length - 1;
        uint256 lastKey = map.keys[lastIndex];

        map.indexOf[lastKey] = index;
        delete map.indexOf[key];

        map.keys[index] = lastKey;
        map.keys.pop();
    }
}

contract TestIterableMap {
    using IterableMapping for IterableMapping.Map;

    IterableMapping.Map private map;

    function testIterableMap() public {
        map.set(uint256(0), 0);
        map.set(uint256(1), 100);
        map.set(uint256(2), 200); // insert
        map.set(uint256(2), 200); // update
        map.set(uint256(3), 300);

        for (uint i = 0; i < map.size(); i++) {
            uint256 key = map.getKeyAtIndex(i);

            assert(map.get(key) == i * 100);
        }

        map.remove(uint256(1));

        // keys = [uint256(0), uint256(3), uint256(2)]
        assert(map.size() == 3);
        assert(map.getKeyAtIndex(0) == uint256(0));
        assert(map.getKeyAtIndex(1) == uint256(3));
        assert(map.getKeyAtIndex(2) == uint256(2));
    }
}
