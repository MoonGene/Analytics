/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.android;

public class EconomyBalanceItem {
    public String id;
    public Long amount;

    public EconomyBalanceItem(String ID, Long Amount) {
        this.id = ID;
        this.amount = Amount;
    }
}
