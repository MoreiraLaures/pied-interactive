import { piedClient } from './class/pied.class';


async function test() {
    const orders = await piedClient.getOrder('260003376');
    console.log(JSON.stringify(orders, null, 2));
}

test();