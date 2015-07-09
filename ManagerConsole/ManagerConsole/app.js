var https = require('https');
var cheerio = require('cheerio');
var request = require('request');
var fs = require('fs');

var baseApiHeaders = {
    'Cookie': 'bunglefrogblastventcore=1436404341; bungled=5527138027679070226; bungles=mt=1&mi=4611686018428389840&ci=2305843009217755842; bunglecounts=onlineFriendCount=2&isCountCached=true&countExpire=1436405584865; bungledid=B2FeQc89NkxKtphhWeLOBwCT3vFQWobSCAAA; bungleatk=wa=Pe2Ubrx3uweC9eVyFkCnLaOOVF.aLSoYmcP6..I8MwhgCQAAf9m688PjHLZBADRjuv30WJZ9A83Z1.wtAsO9Ne8sz94bkc8pi2qgVrce96rJ5AJ-sFtHCZLXsm-b7Y55LQKSgSN-nTfeAZCnZX7LiAnv68sVQAqocXRZKQYdzEb1PVmGWvw3QZ-.o.UMGeC1dEZwb2URxm44lCFAhaOeyZAd3ZCchNRxsNf2OD6g4OtVEnS1N2bvVTLXJCjNhqFuk-tXGy0nRHI1Pf1Op5rQ8iB5L7udGH9r-.DVsF1tC0ts7IX3tzuTb1wHAOfrbM4u02ttwkYTVAmZqC0ipJ32Ljvfh-hnNdqJjd1qcgzKEqwR0LTbMwqdLGId4ySv9vmI8na-DjASybsxreJ6Ax7texY6CKVjzuF9Ir5kJ2gQNP8TLVO9aYoa93ssATh3lV9rFQe81fm76RLhrRMBy9O1kizABEDSd21OsUiFTz0p8XWI-C7pSOWXGrR7thCMfj-ARUQgX4tUVy3xy0WL2UeVOyWTRF9MiBfCjW4lwfQojH2ChoWaN5mxrvhKgBDzO2vHSNM3MqBIAXSqxUcBbhFGSCcj.-HCFW8V6IK6jAQDK5n.dCYHC-KKuN1mrpovMJCb8VV7LjDbDWCJo6YY6aXhMGwuJqHy.piM0mq4kMtr1m4TzB928hLGcq994ArLI15jbzCX.KUD2xMk1GqP9mA0zFhA48BEYHnGmgrEOgAGag4gqA8XkAmr0eVwm-1JRtVTW0r40opusbDHDhgEQm2drFMJFV7PX9g-.1gde26RC-j3IlWHfXy69hD3s8t5eAZ4XS7PQXJf1EY6ohpEPLAlhX2.Z3OzZoDax.Bgu-.sb.RW.lEn3ai-8TKo5s1qFPUYQzFtyuZcIQueDLl3yuas.6cZA0-Yje1XQ4fQjLwMUU8JC-NZ3kHlMg.qdvN7b90hpzaW7sOBttp3DsXxhzeaNgGHtyC-Unzg8HmpnyNwvNQ9gtPKecj6Oj1sjp7KVOfktrTibRyz7uVnnHfDsMEWmb1cCt7fEiIOr2L14wf8o2yvmrDKUn8rfvDLzKCXzMtHUGwFh3Kkz2hUbe8eHARBk21k9Ev-8oqthnUmd0ldbBvFHkF1P0RpMUhiZ0FgDyJaRcK-CHI5OgjnCQFymsvAAHGtBM25R1poTmKZv7EMPQifUea2TBWwJUU3OzBhizYN6J5U.QTsnttqBtbaotFg5Xud0184Esp8ZGTKKKaBGsAN7He2DynqEHuSUMFV0STtAeVtl1Fp2QtWBPLTBmPfMl9Fdx60i55WGHpR5F3FVyp1JIblwcr6ySrJgdQVsoQGwIrF8HY8E9Q1GRnKxLAf7WhWxdBDS3EKYhYmJ8e.v5qoBpvAjZ13gdvvSOeA5AX.3IYSLkRB01PttHdl6ViT8Y2PnNvIoBv3RwxsBS56ulDhQ6eVv3O3U5r2EiOaw5ahV0gjwWXIkefFsVXipoJ7qPhM.AgfB.c-vYeJ8IDHDpqv9yNNxuJEAQpHWc2NwG6ppSELmnPMuM..f76SIJDeLt5JXa6pxEuMtGss6DwgVQucnrNCcxVxLQnRn6Q9lZo9Se7nRv1ee09yylttRsEQgp-kgcBbRHGtg9rznNJNPn-Y67jmh6RbVD6AhuYrrbN.YtLgaobJsv2iHHcMuK1HJWOewoCeVYBoBjGGv.gOFB8HUPJPeV9yqfBLZUBFfLLit9w4pQvsI2cI2vgfSW6UuguQj-AGXAusxfcGrm3edIHbFAcAIncmv6zo0QbTwtVqfZu37OEDush2gH4LjKVqbQUH-Z0OuJZonaziXDE0fUMFPgMcmTdfid6PLqU57FITrNWCW4PqRuKbxPoKfyULJ1lQGmWHbcL5bL90StDZSNZxI7YgTT0VpuQN4LeCiW52GobZBnOCWbN7rGKJpoQ2zDHolTIoegFjnZSQ7ZOtojLoTP8vstaI509pHymt.LjafKxZgH4I1WBPb.-yuMLEY-CqKKbvyexvIJKPB8PwyL0tKx2xEJwI0uFjrS9TQTaEOV2OfUjmrYnwFzVaciws8dPDQPUWPaO-0IxXxsHo9sPRX.YB8Hz0jAkWpAXkGevTJb9fNyPMsQwj6YEvCinfU0Q-W8P3a9unHIIo8CZrsnFUwn6J0.zUw0vgWvUEBqIFyk930kSF99g57FUuhxonCvA3bgCuvV4xRtYZ5QzI0DNEHQPfy0NDF1CYBb.6OjlxDQKEymOq-qX17S2AQavM.DLx76mANxP2JkcNV3kgKG7DD6o6lYorpaRzC6cS1dapiKbZU9Jbn6rDBdlDaXBVprkWI3-0xx-xxdYGmdHDPpFwBCqjKA657dUQpX1LTTZA3J0d5P8Gtc4AL.JYikOr-Oy63Z4TYiCoYkaJQ2Q9d4nD32cf87c0M8SgUNz3Lnn42BpJ1MiIbohBB9VTq.p9gywwg1KoNf4rW1.mIXCvgfhkz51aWZcgZsPYXDdAtGV0jI.nnFJ2rQy0M1ZdgcDD7szr6gfNG7R6NG09BzcpVgvmgdCMXfGK-uoyYDFEGpuIXdH693RFchixZwNu53HBrvXE9U2rLsHjgm8A2p5osdxMjgw2dO3RXXygM9SxHT.YVajYyrFSfrnK2xdzgFDaP4ds2Xu6QxemFUZ2KagqErIBRQAwfaWTfH7iaQZXiwffraDJZDkUYI.INgRltl6bY7OJsFUOaK8LWKt5RhdkTVHHa4inTT30blQRAIvyjMKi4DSloW9uaMRHlV.8gv73nRAShektK3aNYHhID38eOGlMVBICwf.93qtcy10mOOA-oNbTqLm2M7Sa0T1yPsB-FeEx73iwx4MAs9LA7O1h6FAh7WGbrjjx8ata1xoNrOU.LfPZCvlSbAFzQprpQt6aODYtm.5gLxq3KeeQ9fmNQx4ufchBP3Mwl5i2yMysoi1gQm1TNwPPlweulLX63MYDR8FEqPqugCdXluJnLxpL9abmQg-UTw8v8T-Z1wgmmnHJVYHEO737khxuooxuj87ULaFhsdXRyRHquyp3NYKwi3mo1kmxu0RIvNZR1jzXrch1Y4q9EhxQ9isJ3H5eJnh5vG.QE-BHPex.0QL314qHwlu28yS1dPnYGL4koDcyMIZ9zOoXj9twf7WOmnnAjwvVPhaxc499qfp3LrOF5xnOC1axK1rMaJWuBJwaCRhokpUyLBpW1pTLsNJen6Z2V3Dw54kuTMxgIB-San7T-JaxJH-7y52W&tk=YAAAAGxataHLp0iTofJdRvU-GODI1csWj.JNGHw5NbMifi3goHyjbC7y5c.vUuhBwyQ-gHLVeEu-wzYtVuhDCHARLqun2U4PvmfjNiMmX1L0.cNBv8Qu3ohg2DaSYoz2gVOrsCAAAAAOn9eoH4-xohrjnRqc2NEapBswqDRl3zEl3AkqdhpkZg__; bungleme=3227373; bungleloc=lc=en&lcin=true; sto-id-sg_www.bungie.net=OLAKHPAK; __cfduid=d23c130d4532364460619d2475d65f6ec1435877367; __utma=263298975.707323047.1436225190.1436396406.1436403925.5; __utmz=263298975.1436225190.1.1.utmcsr=bing|utmccn=(organic)|utmcmd=organic|utmctr=destiny%20api; __utmb=263298975.27.9.1436405330915; __utmc=263298975'
};

var vaultSidebarUrl = 'https://www.bungie.net/en/Legend/VaultSidebar/1/4611686018428389840/2305843009217755842?ajax=true';

function loadBungieEndpointHtml(endpointUrl, callback) {
    request({
        url: endpointUrl,
        headers: baseApiHeaders
    }, function (shit, moreshit, data) {
        callback(data);
    });
}

function getVaultItems(callback) {
    loadBungieEndpointHtml(vaultSidebarUrl, function (html) {
        var items = [];
        
        var $ = cheerio.load(html);
        $('.sidebarItem.inVault').each(function (i, element) {
            var cheerio = $(this);
            
            var itemInfo = {
                instanceId: cheerio.data('iteminstanceid'),
                hash: cheerio.data('itemhash'),
                stackSize: cheerio.data('stacksize'),
                damageType: cheerio.data('damagetype'),
                name: cheerio.children('.label').children('span').text(),
                specificType: cheerio.children('.subtitle').text(),
                category: cheerio.parent().prev().text()
            };
            
            items.push(itemInfo);
        });

        callback(items);
    });
}

getVaultItems(function (items) {
    console.log(items);
});