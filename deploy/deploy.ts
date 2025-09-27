import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedSafePoll = await deploy("SafePoll", {
    from: deployer,
    log: true,
  });

  console.log(`SafePoll contract: `, deployedSafePoll.address);
};
export default func;
func.id = "deploy_safePoll"; // id required to prevent reexecution
func.tags = ["SafePoll"];
