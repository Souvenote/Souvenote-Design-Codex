import {Module} from "@nestjs/common"
import {AssetController} from "./assets.controller"
import {AssetsServices} from "./assets.service"

@Module({
    controllers:[AssetController],
    providers: [AssetsServices],
})

export class AssetModule{}