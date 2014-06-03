/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package utility;

import java.util.UUID;
import java.nio.ByteBuffer;

public class UUIDHelper {

    //Get ID as a byte array from UUID
    static public byte[] getIdAsBytes(UUID uuid)
    {
        ByteBuffer buffer = ByteBuffer.wrap(new byte[16]);
        buffer.putLong(uuid.getMostSignificantBits());
        buffer.putLong(uuid.getLeastSignificantBits());
        return buffer.array();
    }

    //Get ID as a byte array from String
    static public byte[] getIdAsBytes(String uuid)
    {
        return getIdAsBytes(UUID.fromString(uuid));
    }


}

