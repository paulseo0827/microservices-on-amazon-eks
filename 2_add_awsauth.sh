#!/bin/bash
num=0
add=1
for command in `aws iam list-roles | grep Arn | grep MicroservicesCdkStack | grep Codebui | awk -F'"' '{print $4}'`
do
  echo "eksctl create iamidentitymapping --cluster eks-blueprint --arn  $command --group system:masters --username admin$num"
  num=$(expr $num + $add)
done

